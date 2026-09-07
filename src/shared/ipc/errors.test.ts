import { expect, it } from "vitest";
import { errorMessage, isAppError } from "./errors";

it("recognizes structured IPC failures without losing the user-facing message", () => {
  const error = { code: "conflict", message: "文稿库已被另一个窗口修改" };
  expect(isAppError(error)).toBe(true);
  expect(errorMessage(error)).toBe(error.message);
  expect(errorMessage(new Error("offline"))).toBe("offline");
  expect(errorMessage("legacy message")).toBe("legacy message");
  expect(errorMessage({ apiKey: "private" })).not.toContain("private");
});
