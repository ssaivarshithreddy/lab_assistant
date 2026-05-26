import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import Tesseract from "tesseract.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export async function extractTextFromFile(file: File, onProgress?: (msg: string) => void): Promise<string> {
  const toReadableError = (err: unknown): Error => {
    const msg = err instanceof Error ? err.message : String(err);
    if (/failed to fetch/i.test(msg)) {
      return new Error("OCR assets could not be downloaded. Please check your internet connection and try again.");
    }
    return err instanceof Error ? err : new Error(msg);
  };

  if (file.type === "application/pdf") {
    try {
      onProgress?.("Reading PDF...");
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        onProgress?.(`Reading page ${i} of ${pdf.numPages}...`);
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((it: any) => it.str).join(" ") + "\n";
      }
      // If PDF has no embedded text, fall back to OCR on rasterized pages
      if (text.trim().length < 30) {
        onProgress?.("Scanned PDF detected, running OCR...");
        let ocrText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const fast = import.meta.env.VITE_FAST_OCR === "true";
          const scale = fast ? 1 : 2;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d")!;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/png")!);
          const { data } = await Tesseract.recognize(blob, "eng", {
            logger: (m) => m.status === "recognizing text" && onProgress?.(`OCR page ${i}: ${Math.round(m.progress * 100)}%`),
          });
          ocrText += data.text + "\n";
        }
        return ocrText;
      }
      return text;
    } catch (err) {
      throw toReadableError(err);
    }
  }

  if (file.type.startsWith("image/")) {
    try {
      onProgress?.("Running OCR on image...");
      const { data } = await Tesseract.recognize(file, "eng", {
        logger: (m) => m.status === "recognizing text" && onProgress?.(`OCR: ${Math.round(m.progress * 100)}%`),
      });
      return data.text;
    } catch (err) {
      throw toReadableError(err);
    }
  }

  throw new Error("Unsupported file type. Please upload a PDF or image.");
}
