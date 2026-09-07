use crate::error::{AppError, AppResult};
use reqwest::Url;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use std::{
    net::{IpAddr, SocketAddr},
    time::Duration,
};

#[derive(Clone, Debug, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct LinkPreview {
    pub url: String,
    pub title: String,
    pub description: String,
    pub site: String,
    pub kind: String,
    pub thumbnail: Option<super::assets::Asset>,
}

pub fn public_ip(ip: IpAddr) -> bool {
    if ip.is_loopback() || ip.is_unspecified() || ip.is_multicast() {
        return false;
    }
    match ip {
        IpAddr::V4(ip) => {
            let [a, b, _, _] = ip.octets();
            !ip.is_private()
                && !ip.is_link_local()
                && !ip.is_broadcast()
                && a != 0
                && a < 224
                && !(a == 100 && (64..=127).contains(&b))
                && !(a == 198 && (18..=19).contains(&b))
                && !(a == 192 && b == 0)
        }
        IpAddr::V6(ip) => {
            if let Some(v4) = ip.to_ipv4_mapped() {
                return public_ip(IpAddr::V4(v4));
            }
            let first = ip.segments()[0];
            (first & 0xfe00) != 0xfc00 && (first & 0xffc0) != 0xfe80
        }
    }
}

pub fn url(value: &str) -> AppResult<Url> {
    let parsed =
        Url::parse(value).map_err(|_| AppError::Validation("请输入有效的链接地址".into()))?;
    if value.len() > 4096
        || !matches!(parsed.scheme(), "http" | "https")
        || parsed.host_str().is_none()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err(AppError::Validation("请输入有效的公开网页链接".into()));
    }
    Ok(parsed)
}

async fn response(mut address: Url) -> AppResult<reqwest::Response> {
    for _ in 0..4 {
        let host = address
            .host_str()
            .ok_or_else(|| AppError::Validation("链接缺少主机名".into()))?;
        let host = host.trim_matches(['[', ']']);
        let port = address.port_or_known_default().unwrap_or(443);
        let addresses: Vec<SocketAddr> = match host.parse::<IpAddr>() {
            Ok(ip) => vec![SocketAddr::new(ip, port)],
            Err(_) => tokio::net::lookup_host((host, port)).await?.collect(),
        };
        if addresses.is_empty() || addresses.iter().any(|a| !public_ip(a.ip())) {
            return Err(AppError::Validation("链接预览只支持公开网络地址".into()));
        }
        let client = reqwest::Client::builder()
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(Duration::from_secs(5))
            .timeout(Duration::from_secs(10))
            .resolve_to_addrs(host, &addresses)
            .user_agent("Qwriter/0.2 LinkPreview")
            .build()?;
        let result = client.get(address.clone()).send().await?;
        if result.status().is_redirection() {
            let location = result
                .headers()
                .get("location")
                .and_then(|x| x.to_str().ok())
                .ok_or_else(|| AppError::Network("链接重定向无效".into()))?;
            address = url(address
                .join(location)
                .map_err(|_| AppError::Validation("链接重定向无效".into()))?
                .as_str())?;
            continue;
        }
        if !result.status().is_success() {
            return Err(AppError::Network(
                "无法读取网页预览，可保留普通链接卡片".into(),
            ));
        }
        return Ok(result);
    }
    Err(AppError::Network("链接重定向次数过多".into()))
}

async fn limited(mut response: reqwest::Response, max: usize) -> AppResult<Vec<u8>> {
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await? {
        if bytes.len() + chunk.len() > max {
            return Err(AppError::Validation("网页预览内容超过大小限制".into()));
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}

fn parse(html: &str, address: &Url) -> AppResult<(LinkPreview, Option<String>)> {
    let document = Html::parse_document(html);
    let meta =
        Selector::parse("meta").map_err(|_| AppError::Internal("无法解析网页元数据".into()))?;
    let mut fields = std::collections::HashMap::new();
    for node in document.select(&meta) {
        if let (Some(key), Some(content)) = (
            node.value().attr("property").or(node.value().attr("name")),
            node.value().attr("content"),
        ) {
            fields
                .entry(key.to_ascii_lowercase())
                .or_insert_with(|| content.chars().take(4096).collect::<String>());
        }
    }
    let title_selector =
        Selector::parse("title").map_err(|_| AppError::Internal("无法解析网页元数据".into()))?;
    let title = fields
        .get("og:title")
        .or(fields.get("twitter:title"))
        .cloned()
        .or_else(|| {
            document
                .select(&title_selector)
                .next()
                .map(|e| e.text().collect::<String>())
        })
        .unwrap_or_else(|| address.host_str().unwrap_or_default().into());
    let video = fields
        .get("og:type")
        .is_some_and(|x| x.starts_with("video"))
        || fields.contains_key("og:video")
        || fields.contains_key("og:video:url");
    let thumbnail = fields
        .get("og:image")
        .or(fields.get("twitter:image"))
        .and_then(|s| address.join(s).ok())
        .map(|u| u.to_string());
    Ok((
        LinkPreview {
            url: address.to_string(),
            title: title.chars().take(240).collect(),
            description: fields
                .get("og:description")
                .or(fields.get("description"))
                .cloned()
                .unwrap_or_default()
                .chars()
                .take(600)
                .collect(),
            site: fields
                .get("og:site_name")
                .cloned()
                .unwrap_or_else(|| address.host_str().unwrap_or_default().into())
                .chars()
                .take(120)
                .collect(),
            kind: if video { "video" } else { "link" }.into(),
            thumbnail: None,
        },
        thumbnail,
    ))
}

pub async fn preview(root: std::path::PathBuf, value: String) -> AppResult<LinkPreview> {
    tokio::time::timeout(Duration::from_secs(18), async move {
        let address = url(&value)?;
        let page = response(address).await?;
        let final_url = page.url().clone();
        let mime = page
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or_default();
        if mime.starts_with("video/") {
            return Ok(LinkPreview {
                url: final_url.to_string(),
                title: final_url
                    .path_segments()
                    .and_then(|mut s| s.next_back())
                    .unwrap_or("Video")
                    .into(),
                description: String::new(),
                site: final_url.host_str().unwrap_or_default().into(),
                kind: "video-file".into(),
                thumbnail: None,
            });
        }
        if !mime.contains("text/html") && !mime.contains("application/xhtml") {
            return Err(AppError::Validation("此链接不是可预览的网页或视频".into()));
        }
        let bytes = limited(page, 1024 * 1024).await?;
        let (mut result, thumbnail) = parse(&String::from_utf8_lossy(&bytes), &final_url)?;
        if let Some(image_url) = thumbnail {
            if let Ok(address) = url(&image_url) {
                if let Ok(image) = response(address).await {
                    if let Ok(bytes) = limited(image, 8 * 1024 * 1024).await {
                        result.thumbnail = tauri::async_runtime::spawn_blocking(move || {
                            super::assets::import_bytes(&root, &bytes, "Link preview")
                        })
                        .await
                        .ok()
                        .and_then(Result::ok);
                    }
                }
            }
        }
        Ok(result)
    })
    .await
    .map_err(|_| AppError::Network("网页预览超时，可保留普通链接卡片".into()))?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    #[ignore = "Live public website request; opt in explicitly"]
    async fn live_public_link_preview() {
        let root = std::env::temp_dir().join(format!("qwriter-link-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let result = preview(root.clone(), "https://www.rust-lang.org/".into()).await;
        std::fs::remove_dir_all(root).unwrap();
        let result = result.unwrap();
        assert!(!result.title.is_empty());
        assert!(result.url.starts_with("https://"));
        println!(
            "Public link preview: {}; thumbnail cached: {}",
            result.title,
            result.thumbnail.is_some()
        );
    }
    #[test]
    fn local_addresses_are_rejected_and_metadata_is_plain_text() {
        for ip in [
            "127.0.0.1",
            "10.0.0.1",
            "169.254.169.254",
            "100.64.0.1",
            "::1",
            "::ffff:127.0.0.1",
            "fc00::1",
            "fe80::1",
        ] {
            assert!(!public_ip(ip.parse().unwrap()));
        }
        assert!(public_ip("8.8.8.8".parse().unwrap()));
        assert!(url("file:///etc/passwd").is_err());
        let (meta, image) = parse("<title>A &amp; B</title><meta property='og:image' content='/cover.png'><meta property='og:type' content='video.other'>", &Url::parse("https://example.com/story").unwrap()).unwrap();
        assert_eq!(meta.title, "A & B");
        assert_eq!(meta.kind, "video");
        assert_eq!(image.as_deref(), Some("https://example.com/cover.png"));
    }
}
