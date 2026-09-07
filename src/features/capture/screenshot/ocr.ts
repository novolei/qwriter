import { createWorker, type Worker } from "tesseract.js";
import { readableOcr } from "./text";
let worker: Worker | null = null;
let generation = 0;
let starting = false;
export async function recognize(
  url: string,
  progress: (value: number) => void,
) {
  if (worker || starting) throw new Error("识别正在进行，请稍候");
  const run = ++generation;
  starting = true;
  let current: Worker;
  try {
    current = await createWorker("chi_sim+eng", 1, {
      workerPath: new URL("/ocr/worker.min.js", location.origin).href,
      corePath: new URL("/ocr/core/", location.origin).href,
      langPath: new URL("/ocr/lang/", location.origin).href,
      workerBlobURL: false,
      logger: (message) => {
        if (message.status === "recognizing text") progress(message.progress);
      },
    });
  } finally {
    starting = false;
  }
  if (run !== generation) {
    await current.terminate();
    throw new Error("已取消识别");
  }
  worker = current;
  try {
    return readableOcr((await current.recognize(url)).data.text);
  } finally {
    if (worker === current) {
      worker = null;
      await current.terminate();
    }
  }
}
export async function cancelRecognition() {
  generation++;
  const current = worker;
  worker = null;
  await current?.terminate();
}
