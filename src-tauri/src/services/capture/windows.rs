use super::screens::Screen;
use serde::{Deserialize, Serialize};

/// Bounds relative to the captured display, in the display's coordinate units.
/// Ordered front to back; no window titles or executable paths cross IPC.
#[derive(Clone, Debug, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CaptureWindowBounds {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[cfg(target_os = "windows")]
fn accepts_pointer(window: &xcap::Window) -> bool {
    use windows::Win32::{
        Foundation::HWND,
        UI::WindowsAndMessaging::{GetWindowLongPtrW, GWL_EXSTYLE, WS_EX_TRANSPARENT},
    };
    let Ok(id) = window.id() else {
        return false;
    };
    // Ignore click-through overlays (cursor highlights, screen decorations).
    // They can cover the whole monitor while revealing the actual app below.
    // This read does not retain or dereference the foreign window handle.
    let style = unsafe { GetWindowLongPtrW(HWND(id as usize as *mut _), GWL_EXSTYLE) };
    style as u32 & WS_EX_TRANSPARENT.0 == 0
}

#[cfg(target_os = "macos")]
fn accepts_pointer(_: &xcap::Window) -> bool {
    true
}

fn clipped(
    screen: &Screen,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> Option<CaptureWindowBounds> {
    let left = (i64::from(x) - i64::from(screen.x)).max(0);
    let top = (i64::from(y) - i64::from(screen.y)).max(0);
    let right =
        (i64::from(x) + i64::from(width) - i64::from(screen.x)).min(i64::from(screen.width));
    let bottom =
        (i64::from(y) + i64::from(height) - i64::from(screen.y)).min(i64::from(screen.height));
    if right - left < 24 || bottom - top < 24 {
        return None;
    }
    Some(CaptureWindowBounds {
        x: left as u32,
        y: top as u32,
        width: (right - left) as u32,
        height: (bottom - top) as u32,
    })
}

pub fn snapshot(screen: &Screen) -> Vec<CaptureWindowBounds> {
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        // Enumerate once before showing the capture overlay. Disappearing windows
        // are skipped individually; enumeration failure still permits manual selection.
        xcap::Window::all()
            .unwrap_or_default()
            .into_iter()
            .filter_map(|window| {
                if window.is_minimized().unwrap_or(true) || !accepts_pointer(&window) {
                    return None;
                }
                clipped(
                    screen,
                    window.x().ok()?,
                    window.y().ok()?,
                    window.width().ok()?,
                    window.height().ok()?,
                )
            })
            .take(256)
            .collect()
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = screen;
        Vec::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn clips_cross_screen_windows_with_negative_origins() {
        let screen = Screen {
            id: 1,
            name: String::new(),
            x: -1920,
            y: -200,
            width: 1920,
            height: 1080,
            scale: 1.5,
            primary: false,
        };
        let bounds = clipped(&screen, -2000, -250, 800, 600).unwrap();
        assert_eq!(
            (bounds.x, bounds.y, bounds.width, bounds.height),
            (0, 0, 720, 550)
        );
        assert!(clipped(&screen, 10, 10, 800, 600).is_none());
        assert!(clipped(&screen, i32::MAX, 0, u32::MAX, 600).is_none());
    }
}
