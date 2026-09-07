# Screenshot selection bridge

`react-screenshots` is pinned to 0.5.22. Its published API lacks an external
selection input. The patch adds `selectionRequest` and `onSelectionChange` to
the ESM/CommonJS bundles and declarations, and clears the background drag refs
when an external selection arrives. Qwriter continues to use the
upstream cropper, annotations and history implementation.

`npm ci` / `npm install` applies the patch through `patch-package --error-on-fail`.
Do not upgrade or remove this patch without running the real-package test in
`src/shared/media/annotation/vendorSelection.test.tsx` and exercising native
window selection, manual drag, annotations, undo and completion. Window
selection is scheduled after mouseup so the upstream release handler finishes
before controlled bounds change.

Upstream: https://github.com/nashaofu/screenshots
