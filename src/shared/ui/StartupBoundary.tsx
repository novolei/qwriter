import { Component, type ReactNode } from "react";
import { t } from "../i18n";

/** Keeps failed lazy modules recoverable without displaying provider or user data. */
export class StartupBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="startup-recovery" role="alert">
        <h1>{t("暂时无法打开工作区")}</h1>
        <p>{t("应用资源加载中断。已保存的内容仍在本机，请重新打开。")}</p>
        <button className="primary" onClick={() => window.location.reload()}>
          {t("重新打开")}
        </button>
      </main>
    );
  }
}
