# Image preview and editing

The user selected an in-app draggable preview window. Double-clicking an image (or pressing Enter on its focused figure) opens the shared Radix modal. Drag the heading to move it; arrow keys move a focused heading and Home centers it. Resize resets its position to keep the window reachable.

The preview provides fit/actual size, save-as, and crop/annotation modes. The existing react-screenshots integration is now shared by capture and document images. It provides crop selection, rectangle, ellipse, arrow, pen, text, mosaic, undo and redo. Annotation results become new content-addressed assets. They remain staged until Apply; restoring the original or closing the preview does not modify the manuscript. External images can be previewed; editing requires a successful browser CORS fetch and supported image format.

Applying resolves the original node's live position and validates its source and document identity, preserving caption/title. Replacement is an isolated undo step. Removed/replaced nodes and closed documents reject stale results. Original asset bytes are retained.

Images and media cards use the same 1 px muted green selection outline and rounded corners. The empty-paragraph insertion control now uses vertically centered Floating UI placement instead of top alignment.

## Verification

- Browser: double-click, drag (60 px horizontally / 40 px vertically), crop, arrow annotation, stage, apply, undo to original; cancel annotation returns to preview with Apply disabled.
- 900 × 640: preview actions/footer fit the window. 2560 × 1440: 1000 × 780 modal remains fully inside the viewport. Normal desktop preview also inspected.
- Empty paragraph: button and line centers differed by under 0.2 CSS px.
- Regression tests cover staged edits, restore, failed/stale apply, original captions, targeted replacement after position changes, and undo/redo.
- Full `npm run check` passes. Platform verified: Windows browser preview; this change does not constitute macOS native verification.
