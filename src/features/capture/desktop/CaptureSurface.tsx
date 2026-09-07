import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ExternalLink, Minus, Pin, X } from "lucide-react";
import {
  commands,
  type Asset,
  type ScreenCapture,
} from "../../../shared/ipc/bindings";
import { errorText, t, changeLanguage } from "../../../shared/i18n";
import { BrandIcon } from "../../../shared/brand/BrandIcon";
import { AssetView } from "../../../shared/media/AssetView";
import { QuickComposer } from "../QuickComposer";
import { newCard, type Card } from "../cards";
import { recoverDraft } from "../drafts";
import {
  ScreenshotEditor,
  warmAnnotationEditor,
} from "../screenshot/ScreenshotEditor";
import { ScreenshotResult } from "../screenshot/ScreenshotResult";
import { useCaptureSeeds } from "./useCaptureSeeds";
import { useCaptureDismiss } from "./useCaptureDismiss";
import type { CaptureCopyNotice } from "../../../shared/media/annotation/completeCapture";
import { normalizeTypography, fontFamily } from "../../settings/typography";
function preference(key: string) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}
const draftKey = "qwriter.capture.floating-draft";

export function CaptureSurface({ pin = false }: { pin?: boolean }) {
  useTranslation();
  useEffect(() => {
    if (!pin)
      void warmAnnotationEditor().catch(() => {
        // A later interactive load retains the existing retry/error boundary.
      });
  }, [pin]);
  const [error, setError] = useState("");
  const [screenshotMode, setScreenshotMode] = useState(false);
  const [dark, setDark] = useState(
    localStorage.getItem("qwriter.dark") === "true",
  );
  const [typography, setTypography] = useState(() =>
    normalizeTypography(preference("qwriter.typography")),
  );
  useEffect(() => {
    const changed = () => {
      void changeLanguage(
        localStorage.getItem("qwriter.language") === "en" ? "en" : "zh-CN",
      );
      setDark(localStorage.getItem("qwriter.dark") === "true");
      try {
        setTypography(normalizeTypography(preference("qwriter.typography")));
      } catch {
        /* retain valid settings */
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  async function action(value: string) {
    try {
      await commands.captureWindow(value);
    } catch (error) {
      setError(errorText(error));
    }
  }
  useCaptureDismiss(pin, () => void action("hide"));
  return (
    <div
      className={`app detached-app ${dark ? "dark" : ""}`}
      style={
        {
          "--ui-font": fontFamily(typography.uiFont, typography.uiLatin),
        } as React.CSSProperties
      }
    >
      <header className="capture-window-bar">
        <div
          className="capture-window-brand"
          onPointerDown={(event) => {
            if (event.button === 0) void action("drag");
          }}
        >
          <BrandIcon size={28} />
          <strong className="brand-wordmark">Qwriter</strong>
          <span className="capture-window-context">
            {t(pin ? "参考图" : screenshotMode ? "截图工作台" : "随手速记")}
          </span>
        </div>
        <button
          aria-label={t("返回文稿")}
          title={t("返回文稿")}
          onClick={() =>
            pin
              ? void action("main")
              : window.dispatchEvent(new Event("qwriter-capture-main"))
          }
        >
          <ExternalLink size={14} />
        </button>
        <button
          aria-label={t("窗口置顶")}
          title={t("窗口置顶")}
          onClick={() => void action("toggle-pin")}
        >
          <Pin size={14} />
        </button>
        <button
          aria-label={t("收起浮窗")}
          title={t("收起浮窗")}
          onClick={() =>
            pin
              ? void action("hide")
              : window.dispatchEvent(new Event("qwriter-capture-close"))
          }
        >
          <Minus size={16} />
        </button>
      </header>
      {error && (
        <p className="capture-error" role="alert">
          {error}
        </p>
      )}
      {pin ? (
        <PinnedImage />
      ) : (
        <CaptureContent onModeChange={setScreenshotMode} />
      )}
    </div>
  );
}
function CaptureContent({
  onModeChange,
}: {
  onModeChange: (screenshot: boolean) => void;
}) {
  const incoming = useCaptureSeeds();
  const [card, setCard] = useState<Card | null>(null);
  const [source, setSource] = useState<ScreenCapture | Asset | null>(null);
  const [result, setResult] = useState<Asset | null>(null);
  const [copyNotice, setCopyNotice] = useState<CaptureCopyNotice>();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const seed = incoming.seed;
  useEffect(() => {
    onModeChange(Boolean(source || result));
  }, [source, result, onModeChange]);
  useEffect(() => {
    if (!seed) return;
    setSaved(false);
    setError("");
    setResult(null);
    if (seed.mode === "error") {
      setSource(null);
      setError(errorText(seed.text));
      setCard(recoverDraft(draftKey));
    } else if (seed.screenshot) {
      setSource(seed.screenshot);
      setCard(null);
    } else {
      setSource(null);
      setCard(
        seed.text || seed.assetIds.length
          ? newCard({ text: seed.text, assetIds: seed.assetIds })
          : recoverDraft(draftKey),
      );
    }
  }, [seed]);
  async function close() {
    try {
      if (source && "path" in source) await commands.captureRelease(source.id);
      setSource(null);
      setCard(null);
      setResult(null);
      incoming.next();
      if (incoming.count <= 1) await commands.captureWindow("hide");
    } catch (error) {
      setError(errorText(error));
    }
  }
  useCaptureDismiss(!source, () => void close());
  useEffect(() => {
    const dismiss = () => {
      void close();
    };
    const main = () => {
      void close()
        .then(() => commands.captureWindow("main"))
        .catch((error) => setError(errorText(error)));
    };
    window.addEventListener("qwriter-capture-close", dismiss);
    window.addEventListener("qwriter-capture-main", main);
    return () => {
      window.removeEventListener("qwriter-capture-close", dismiss);
      window.removeEventListener("qwriter-capture-main", main);
    };
  });
  async function resized(value: string) {
    try {
      await commands.captureWindow(value);
    } catch (error) {
      setError(errorText(error));
    }
  }
  if (source)
    return (
      <div className="detached-annotation">
        <ScreenshotEditor
          key={source.id}
          source={source}
          onCancel={() => {
            void close();
          }}
          onResult={(asset, notice) => {
            setCopyNotice(notice);
            setSource(null);
            setResult(asset);
            void resized("review");
          }}
        />
      </div>
    );
  return (
    <main className="capture-window-content">
      {incoming.count > 1 && (
        <p className="capture-hint">
          {t("还有 {{count}} 份捕捉等待处理", { count: incoming.count - 1 })}
        </p>
      )}
      {(error || incoming.error) && (
        <p role="alert" className="capture-error">
          {error || incoming.error}
        </p>
      )}
      {result ? (
        <>
          <div className="detached-result-heading">
            <h2>{t("这一刻，已留住")}</h2>
            <button title={t("关闭")} onClick={() => void close()}>
              <X size={18} />
            </button>
          </div>
          <ScreenshotResult
            key={result.id}
            asset={result}
            notice={copyNotice}
            onEdit={(asset) => setSource(asset)}
            onNote={(text, asset) => {
              setResult(null);
              setCard(newCard({ text, assetIds: [asset.id] }));
              void resized("note");
            }}
            onInsert={async (asset) => {
              await commands.captureInsert(asset.id);
              setResult(null);
              incoming.next();
            }}
          />
        </>
      ) : card ? (
        <QuickComposer
          key={card.id}
          initial={card}
          draftKey={draftKey}
          onDismiss={() => void close()}
          onSaved={() => {
            setSaved(true);
            setCard(null);
            incoming.next();
          }}
        />
      ) : (
        <div className="capture-saved">
          <Check size={26} />
          <h2>{t(saved ? "灵感已妥善收藏" : "让一个想法，在这里停留")}</h2>
          <button
            className="primary"
            onClick={() => {
              setCard(newCard());
              setSaved(false);
            }}
          >
            {t("再记一个")}
          </button>
          <button className="quiet-button" onClick={() => void close()}>
            {t("收起浮窗")}
          </button>
        </div>
      )}
    </main>
  );
}
function PinnedImage() {
  const [id, setId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    let stop: (() => void) | undefined;
    const load = async () => {
      const value = await commands.capturePinned();
      if (alive) setId(value);
    };
    void import("@tauri-apps/api/event")
      .then(async ({ listen }) => {
        const cleanup = await listen("pin-changed", () => {
          void load().catch((error) => setError(errorText(error)));
        });
        if (!alive) cleanup();
        else {
          stop = cleanup;
          await load();
        }
      })
      .catch((error) => setError(errorText(error)));
    return () => {
      alive = false;
      stop?.();
    };
  }, []);
  return (
    <div className="pin-content">
      {id && (
        <div className="pin-image" style={{ width: `${zoom}%` }}>
          <AssetView id={id} name={t("参考图")} />
        </div>
      )}
      <label className="pin-zoom">
        {t("缩放")}
        <input
          aria-label={t("参考图缩放")}
          type="range"
          min={30}
          max={200}
          value={zoom}
          onChange={(event) => setZoom(+event.target.value)}
        />
        {zoom}%
      </label>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
