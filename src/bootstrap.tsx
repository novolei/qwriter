import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
const App = lazy(() =>
  import("./app/App").then((module) => ({ default: module.App })),
);

const CaptureSurface = lazy(() =>
  import("./features/capture/desktop/CaptureSurface").then((module) => ({
    default: module.CaptureSurface,
  })),
);
const surface = new URLSearchParams(location.search).get("surface");
const root = document.getElementById("root");
if (root) {
  const appRoot = createRoot(root);
  import.meta.hot?.dispose(() => appRoot.unmount());
  appRoot.render(
    <StrictMode>
      <Suspense fallback={null}>
        {surface === "capture" || surface === "pin" ? (
          <CaptureSurface pin={surface === "pin"} />
        ) : (
          <App />
        )}
      </Suspense>
    </StrictMode>,
  );
}

import "./styles/fonts";

import "./styles/index.css";
