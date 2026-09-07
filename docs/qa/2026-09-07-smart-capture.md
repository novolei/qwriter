# Smart screenshot selection and clipboard

## Implemented

- Native xcap window enumeration before overlay creation; front-to-back hit
  testing, display-relative bounds and clipping. Enumeration failures retain
  manual capture. Only geometry crosses IPC, not titles or process paths.
- Windows click-through overlays are excluded through their extended style.
- Click chooses a window; drag still creates a region. External selection
  explicitly clears the upstream pending drag and is applied after mouseup.
- Source-pixel magnifier with hex color and Ctrl/Cmd+C copying. Text fields,
  annotation text, IME composition and modified shortcuts preserve normal copy.
- Screenshot completion imports the image and copies it before opening preview.
  Clipboard failure retains the asset and offers retry in preview. Document image
  editing does not automatically overwrite the clipboard.
- Chinese/English strings, existing theme tokens and responsive annotation host.

## Verification (Windows, 2026-09-07)

- Global Ctrl+Alt+S invoked from File Explorer while Qwriter was not foreground.
- Hover showed window candidate and original-pixel magnifier; Ctrl+C returned
  `#FFFFFF` with the localized success message.
- A separate Explorer window selected as 1268 × 1386 CSS units; at 150% scale
  the completed PNG was 1902 × 2079 pixels. Moving to the confirmation toolbar
  retained the window selection.
- Clicking the visible checkmark opened preview with “图片已复制”. Closing preview
  and invoking Ctrl+Shift+Space opened a quick note with the same image attached,
  proving native clipboard readback. No document was changed.
- Browser: imported image, manual selection, automatic copy feedback, re-entry
  into annotation, Escape, and 900 × 640 layout. English capture entry verified.
- Regression tests cover clipped/negative screen origins, scaling, z order,
  shortcut exclusions, deferred window selection, real vendor selection API,
  clipboard completion/failure/cancellation and document-edit isolation.

## Defects found and resolved

- A transparent desktop cursor highlight was selected as a full-screen window:
  filter `WS_EX_TRANSPARENT`, then verify the Explorer window boundary.
- The cropper retained a mouse-down after external selection: clear its drag
  state explicitly and defer bounds changes until the mouseup dispatch completes.
- Browser image annotation incorrectly advertised native window recognition:
  only show this instruction when native candidates are available.
- Tiptap image tooltip did not refresh after a language switch: subscribe the
  independent node view to the existing i18next language event.
- Search preview displayed internal media JSON: use its title in the excerpt,
  keeping the original Markdown unchanged; regression test added.

## Boundaries

Window selection crops the visible pixels within the selected display. It does
not reconstruct obscured content or combine portions across displays. macOS
window geometry and Cmd+C are implemented but require macOS hardware verification;
Windows tests do not validate macOS permissions or Retina behavior.

The pinned upstream adapter is documented in `patches/README.md`. Validation:
`npm run check` and `npm run desktop:build`; see workspace capture-smart logs.

Final checks passed: 40 frontend test files / 90 tests; Rust 33 passed and
3 existing ignored tests; architecture, i18n, formatting, TypeScript, Clippy
and IPC drift checks passed. The Windows debug executable was built successfully.
