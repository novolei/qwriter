import type { AppError } from "./bindings";

export function isAppError(error: unknown): error is AppError {
  if (!error || typeof error !== "object") return false;
  const value = error as Record<string, unknown>;
  return (
    typeof value.message === "string" &&
    [
      "validation",
      "storage",
      "conflict",
      "network",
      "git",
      "internal",
    ].includes(String(value.code))
  );
}

export function errorMessage(error: unknown): string {
  if (isAppError(error) || error instanceof Error) return error.message;
  return typeof error === "string" ? error : "后台任务未能完成，请重试";
}
