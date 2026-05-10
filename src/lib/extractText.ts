import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import Tesseract from "tesseract.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export async function extractTextFromFile(file: File, onProgress?: (msg: string) => void): Promise<string> {
  if (file.type === "application/pdf") {
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
        const fast = import.meta.env.VITE_FAST_OCR === 'true';
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
  }

  if (file.type.startsWith("image/")) {
    onProgress?.("Running OCR on image...");
    const { data } = await Tesseract.recognize(file, "eng", {
      logger: (m) => m.status === "recognizing text" && onProgress?.(`OCR: ${Math.round(m.progress * 100)}%`),
    });
    return data.text;
  }

  throw new Error("Unsupported file type. Please upload a PDF or image.");
}
