import { Component, type ReactNode } from "react";
import { t } from "../i18n";
import { Modal } from "./Modal";
export class FeatureBoundary extends Component<
  { children: ReactNode; onClose: () => void; resetKey: unknown },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(previous: Readonly<{ resetKey: unknown }>) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed)
      this.setState({ failed: false });
  }
  render() {
    if (this.state.failed)
      return (
        <Modal title={t("此工具暂时未能打开")} onClose={this.props.onClose}>
          <p>
            {t(
              "你的文稿仍然保留。请关闭后重试；若刚刚更新了应用，请保存文稿后重新打开应用。",
            )}
          </p>
          <button className="primary" onClick={this.props.onClose}>
            {t("返回文稿")}
          </button>
        </Modal>
      );
    return this.props.children;
  }
}
