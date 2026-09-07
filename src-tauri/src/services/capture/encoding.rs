use image::{
    codecs::png::{CompressionType, FilterType, PngEncoder},
    ExtendedColorType, ImageEncoder, RgbaImage,
};
use std::io::Write;

/// Temporary screenshots prioritize latency; fixed Sub filtering remains lossless.
/// Permanent exports retain their existing encoding policy.
pub fn write_preview(writer: impl Write, image: &RgbaImage) -> image::ImageResult<()> {
    PngEncoder::new_with_quality(writer, CompressionType::Fast, FilterType::Sub).write_image(
        image.as_raw(),
        image.width(),
        image.height(),
        ExtendedColorType::Rgba8,
    )
}

#[cfg(test)]
mod tests {
    #[test]
    fn preview_preserves_every_channel_for_color_picking() {
        let source = image::RgbaImage::from_fn(37, 23, |x, y| {
            image::Rgba([(x * 7) as u8, (y * 11) as u8, (x ^ y) as u8, (x + y) as u8])
        });
        let mut encoded = Vec::new();
        super::write_preview(&mut encoded, &source).unwrap();
        assert_eq!(
            image::load_from_memory(&encoded).unwrap().to_rgba8(),
            source
        );
    }
}
