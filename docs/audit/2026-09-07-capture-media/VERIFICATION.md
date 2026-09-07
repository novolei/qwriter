# Capture & media verification — 2026-09-07

Final quality run: **58 frontend tests passed; 31 Rust tests passed; 3 opt-in tests ignored**. Architecture checks cover 200 source files and the 500-line limit. TypeScript, formatting, Clippy and generated IPC bindings checks passed.

Windows debug build completed at 05:04 local time, 2026-09-07. Output: `D:/Qwriter/src-tauri/target/debug/qwriter.exe` (96,978,944 bytes). No installer, code signing, macOS build or macOS desktop testing performed. Vite still reports existing large editor/application chunks; new screenshot UI is a lazy chunk of approximately 35.5 kB before gzip. Build emits Windows linker informational warnings but exits successfully.

## Browser flows exercised

- Local image import, caption, rich editor insertion and reload persistence.
- Two-second 640×360 H.264 MP4: readyState 4, duration 2 seconds; inserted video still decodes after page reload.
- Website card fallback, editable caption and video-page type selection; user-provided image used as manual card cover.
- Clipboard text capture; clipboard PNG attachment; draft recovery; Ctrl/⌘ Enter save.
- Four new demonstration notes; pin, search, archive and restore; insert a saved card into the dedicated verification document.
- Screenshot crop; rectangle selected through keyboard; drawing, undo and redo; complete into result view.
- Copy image shows success. Local Tesseract worker returns Chinese and English text, editable and transferred with the image into a saved note.
- Two image frames stitched into a 678×525 PNG, previewed and inserted into the verification document.
- Original manuscript remains 346 characters, including its ending “感谢有你！”. Current document selection restored to the original; final open panel is Inspiration. User's Chinese / light preferences restored; temporary viewport overrides reset.
- 900×640 and 1920×1080 layouts, English and Chinese, paper and forest themes. Focus moves to the note body when changing from another dialog; covered by a regression test as well.

## Explicit limits of this verification

- Public link preview live test failed because the local resolver maps www.rust-lang.org to reserved Fake-IP 198.18.6.222. Protection was retained. Metadata parsing and cached-image persistence have local tests; successful real-world thumbnail retrieval is **not** claimed.
- The IAB download event timed out although the app displayed the export confirmation. File arrival in a download directory is **not** verified.
- Native screenshot capture, minimized global shortcuts, clipboard plugin, pinning, native save dialogs, monitor DPI and macOS privacy permissions are implemented but **not** desktop-interaction tested; computer tools in this session only control the browser.
- Automatic scrolling screenshots, automatic window snapping, numbered annotations and cross-application selection/copy automation are **not implemented**. Current long-image tool combines manually supplied frames.
- Browser test data is separate from the native SQLite library. No AI request was made in this feature verification.

## Visual evidence

- `inspiration-desktop.png`: final card grid and sidebar context.
- `inspiration-900x640.png`, `quick-note-900x640.png`: constrained window layouts.
- `inspiration-1920x1080.png`: large window layout.
- `inspiration-en-dark.png`, `quick-note-en-dark.png`: English forest theme.
- `annotation.png`, `ocr-result.png`: crop / annotation and local recognition results.
- `media-document.png`: persistent local video and video card in the rich editor.
- `video-fixture.mp4`: generated two-second technical decoding fixture, not a product visual asset.

See `docs/CAPTURE-MEDIA.md` for architecture, shortcuts, dependencies and support boundaries. Root `capture-check-final.log` and `capture-desktop-build.log` contain the latest full commands' output (ignored by source control).
