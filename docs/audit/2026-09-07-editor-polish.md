# Editor polish verification — 2026-09-07

- Paragraph rail: fixed 8 px inset from the editor column, centered within the writing canvas. Resting marks are half their previous width; the current paragraph uses a 14 px mark. Hover and keyboard focus expand the marks. Short windows retain a scrollable rail; narrow manuscript layouts reserve space for its hit targets.
- Provider fields: labels share a baseline and the provider selector/name input both measure 40 px high, with identical top and bottom positions. The extra selector margin no longer affects connection grids.
- Toolbar selectors: paragraph style and size use a single enclosing hover background. Inner triggers have transparent borders/backgrounds and no shadow; keyboard focus is indicated on the enclosing control.

## Browser verification

- 1440 × 960: rail inset 8 px, vertical center error below 0.001 px; resting widths 6–14 px. Provider labels and controls align.
- 900 × 640: rail remains centered, no horizontal page overflow, keyboard arrow navigation opens the paragraph preview. Provider labels and controls still align. Expanded navigation has a separate gutter from manuscript text.
- 2560 × 1440: rail inset remains 8 px, vertical center error below 0.001 px, no horizontal page overflow.
- Selector opens by keyboard. Pointer hover verified with `:hover` true and `:focus-visible` false: inner border transparent, shadow none, no enclosing outline. Keyboard focus retains an enclosing indicator.
- Existing manuscript remains at 346 characters. No text or provider settings were edited.

## Automated checks

`npm run check` passed: architecture, formatting, TypeScript, 58 frontend tests, Rust fmt/clippy, 31 Rust tests (3 ignored), and IPC binding drift checks.

`npm run desktop:build` passed. The first attempt encountered an executable lock from a running Qwriter instance; after that instance exited, rebuilding succeeded. Launched `src-tauri/target/debug/qwriter.exe` and visually confirmed the native window displays its saved manuscript and the short, centered paragraph rail.

Platform: Windows. macOS native verification remains outstanding.
