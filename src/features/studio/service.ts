import { commands } from "../../shared/ipc/bindings";

/** ComfyUI's open-ended workflow stays JSON at the protocol boundary. */
export async function requestComfy(
  baseUrl: string,
  workflow: unknown | null,
  promptId: string | null,
): Promise<Record<string, unknown>> {
  const payload = workflow === null ? null : JSON.stringify(workflow);
  const value: unknown = JSON.parse(
    await commands.comfyRequest(baseUrl, payload ?? null, promptId),
  );
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("服务未返回有效 JSON");
  return value as Record<string, unknown>;
}
