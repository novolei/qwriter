import { Component, type ReactNode } from "react";
import { t } from "../../i18n";

/** Keep a usable exit even when a vendor canvas effect throws. Never discard the source. */
export class AnnotationBoundary extends Component<
  { children: ReactNode; onCancel: () => void },
  { failed: boolean; attempt: number }
> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="screenshot-problem" role="alert">
          <strong>{t("标注工作台未能打开")}</strong>
          <p>{t("原图仍然保留。可以重试，或退出后重新截图。")}</p>
          <button
            onClick={() =>
              this.setState(({ attempt }) => ({
                failed: false,
                attempt: attempt + 1,
              }))
            }
          >
            {t("重试")}
          </button>
          <button onClick={this.props.onCancel}>{t("退出截图")}</button>
        </div>
      );
    return (
      <div key={this.state.attempt} className="annotation-canvas">
        {this.props.children}
      </div>
    );
  }
}
