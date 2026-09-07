import { useEffect, useState } from "react";
import { ImageOff, Play } from "lucide-react";
import { assetUrl } from "./assets";
import { t } from "../i18n";

export function AssetView({
  id,
  name = "",
  video = false,
  className = "",
  controls = true,
}: {
  id: string;
  name?: string;
  video?: boolean;
  className?: string;
  controls?: boolean;
}) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setSrc("");
    setFailed(false);
    void assetUrl(id)
      .then((value) => {
        if (alive) setSrc(value);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [id]);
  if (failed)
    return (
      <div className="asset-missing">
        <ImageOff size={22} />
        <span>{t("素材暂不可用")}</span>
      </div>
    );
  if (!src)
    return <div className="asset-loading" aria-label={t("正在打开…")} />;
  return video ? (
    <video
      className={className}
      src={src}
      controls={controls}
      tabIndex={controls ? undefined : -1}
      preload="metadata"
      aria-label={name}
      onError={() => setFailed(true)}
    />
  ) : (
    <img
      className={className}
      src={src}
      alt={name}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export function VideoBadge() {
  return (
    <span className="video-badge">
      <Play size={15} fill="currentColor" />
    </span>
  );
}
