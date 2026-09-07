import { expect, it } from "vitest";
import { emptyImageHistory, imageEditHistory } from "./image-edit-history";
import type { Asset } from "../../../shared/media/assets";
const asset = (id: string): Asset => ({
  id,
  mime: "image/png",
  name: id,
  size: 1,
  width: 10,
  height: 10,
});

it("undoes multiple edits and retains redo after restoring the original", () => {
  const first = imageEditHistory(emptyImageHistory, {
    type: "edit",
    asset: asset("a"),
  });
  const second = imageEditHistory(first, { type: "edit", asset: asset("b") });
  expect(imageEditHistory(second, { type: "undo" }).cursor).toBe(0);
  const restored = imageEditHistory(second, { type: "restore" });
  expect(restored.cursor).toBe(-1);
  const redo = imageEditHistory(restored, { type: "redo" });
  expect(redo.versions[redo.cursor].id).toBe("a");
  expect(imageEditHistory(redo, { type: "redo" }).versions[1].id).toBe("b");
  expect(imageEditHistory(second, { type: "redo" }).cursor).toBe(1);
  expect(imageEditHistory(emptyImageHistory, { type: "undo" }).cursor).toBe(-1);
});

it("branches from the current revision without mutating earlier history", () => {
  const first = imageEditHistory(emptyImageHistory, {
    type: "edit",
    asset: asset("a"),
  });
  const second = imageEditHistory(first, { type: "edit", asset: asset("b") });
  const undone = imageEditHistory(second, { type: "undo" });
  const branch = imageEditHistory(undone, { type: "edit", asset: asset("c") });
  expect(branch.versions.map((value) => value.id)).toEqual(["a", "c"]);
  expect(second.versions.map((value) => value.id)).toEqual(["a", "b"]);
  expect(imageEditHistory(branch, { type: "edit", asset: asset("c") })).toBe(
    branch,
  );
});
