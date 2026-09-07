//! Opt-in local diagnostics. No pixels, window names or paths are logged or retained.
#[test]
#[ignore = "captures the local display; run explicitly on a desktop"]
fn capture_latency() -> Result<(), Box<dyn std::error::Error>> {
    use image::{
        codecs::png::{CompressionType, FilterType, PngEncoder},
        ImageEncoder,
    };
    use std::time::Instant;
    for attempt in 0..3 {
        let start = Instant::now();
        let monitors = xcap::Monitor::all()?;
        let monitor = monitors
            .iter()
            .find(|m| m.is_primary().unwrap_or(false))
            .ok_or("No primary monitor")?;
        let enumerated = start.elapsed();
        let windows_start = Instant::now();
        let screen = super::screens::Screen {
            id: monitor.id()?,
            name: String::new(),
            x: monitor.x()?,
            y: monitor.y()?,
            width: monitor.width()?,
            height: monitor.height()?,
            scale: 1.0,
            primary: true,
        };
        let windows = super::windows::snapshot(&screen);
        let windows_time = windows_start.elapsed();
        let frame_start = Instant::now();
        let frame = monitor.capture_image()?;
        let frame_time = frame_start.elapsed();
        eprintln!("capture attempt={attempt} monitor_ms={} windows_ms={} window_count={} frame_ms={} pixels={}x{}", enumerated.as_millis(), windows_time.as_millis(), windows.len(), frame_time.as_millis(), frame.width(), frame.height());
        for (name, compression, filter) in [
            ("default", CompressionType::default(), FilterType::default()),
            ("preview", CompressionType::Fast, FilterType::Sub),
        ] {
            let encode_start = Instant::now();
            let mut bytes = Vec::new();
            PngEncoder::new_with_quality(&mut bytes, compression, filter).write_image(
                frame.as_raw(),
                frame.width(),
                frame.height(),
                image::ExtendedColorType::Rgba8,
            )?;
            eprintln!(
                "capture encoding={name} encode_ms={} bytes={}",
                encode_start.elapsed().as_millis(),
                bytes.len()
            );
        }
    }
    Ok(())
}
