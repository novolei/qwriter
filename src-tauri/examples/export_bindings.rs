fn main() -> Result<(), Box<dyn std::error::Error>> {
    let destination = std::env::args()
        .nth(1)
        .ok_or("Usage: export_bindings <path>")?;
    let exporter = std::thread::Builder::new()
        .name("protocol-export".into())
        .stack_size(16 * 1024 * 1024)
        .spawn(move || {
            qwriter_lib::export_bindings(std::path::Path::new(&destination))
                .map_err(|error| error.to_string())
        })?;
    exporter
        .join()
        .map_err(|_| "Protocol exporter failed")?
        .map_err(Into::into)
}
