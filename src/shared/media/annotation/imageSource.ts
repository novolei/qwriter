/** Third-party canvas tools must receive an origin-clean image, including in WebView2. */
export async function canvasImageSource(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("图片未能载入，请重试");
  const blob = await response.blob();
  if (!blob.size || blob.size > 64 * 1024 * 1024)
    throw new Error("图片未能载入，请重试");
  signal.throwIfAborted();
  return URL.createObjectURL(blob);
}
