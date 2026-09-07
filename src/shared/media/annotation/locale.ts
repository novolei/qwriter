import type { Lang } from "react-screenshots/lib/types/zh_CN";
import { t } from "../../i18n";

/** Keep vendor property names stable; displayed copy belongs in the catalogs. */
export function annotationLocale(): Lang {
  return {
    magnifier_position_label: t("annotation.position"),
    operation_ok_title: t("annotation.done"),
    operation_cancel_title: t("annotation.cancel"),
    operation_save_title: t("annotation.save"),
    operation_redo_title: t("annotation.redo"),
    operation_undo_title: t("annotation.undo"),
    operation_mosaic_title: t("annotation.mosaic"),
    operation_text_title: t("annotation.text"),
    operation_brush_title: t("annotation.pen"),
    operation_arrow_title: t("annotation.arrow"),
    operation_ellipse_title: t("annotation.ellipse"),
    operation_rectangle_title: t("annotation.rectangle"),
  };
}
