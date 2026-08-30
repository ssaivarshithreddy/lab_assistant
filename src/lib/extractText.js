import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import Tesseract from "tesseract.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

/**
 * Preprocesses a canvas to improve OCR recognition (grayscale + contrast thresholding)
 */
function enhanceImageForOCR(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  try {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      // Luminance Grayscale
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      // Adaptive Contrast Threshold
      const boosted = (gray - 128) * 1.35 + 128;
      const finalVal = boosted > 190 ? 255 : boosted < 90 ? 0 : boosted;
      data[i] = finalVal;     // Red
      data[i + 1] = finalVal; // Green
      data[i + 2] = finalVal; // Blue
    }
    ctx.putImageData(imgData, 0, 0);
  } catch (e) {
    console.warn("Canvas image preprocessing skipped:", e.message);
  }
  return canvas;
}

/**
 * Sorts PDF text items into proper visual lines (Top-to-Bottom, Left-to-Right)
 */
function sortPdfTextItems(items) {
  if (!Array.isArray(items)) return "";
  const validItems = items.filter((it) => it && typeof it.str === "string" && it.str.trim() !== "");
  
  // Sort primarily by Y-coordinate (top to bottom), then by X-coordinate (left to right)
  validItems.sort((a, b) => {
    const yA = a.transform ? a.transform[5] : 0;
    const yB = b.transform ? b.transform[5] : 0;
    const xA = a.transform ? a.transform[4] : 0;
    const xB = b.transform ? b.transform[4] : 0;

    const yDiff = Math.abs(yB - yA);
    if (yDiff < 5) {
      return xA - xB; // Same line (within 5px tolerance), sort left to right
    }
    return yB - yA; // Top to bottom (higher Y value in PDF coordinate space is higher on page)
  });

  let text = "";
  let lastY = null;

  for (const item of validItems) {
    const currentY = item.transform ? item.transform[5] : 0;
    if (lastY !== null && Math.abs(lastY - currentY) >= 5) {
      text += "\n";
    } else if (text.length > 0 && !text.endsWith("\n") && !text.endsWith(" ")) {
      text += " ";
    }
    text += item.str.trim();
    lastY = currentY;
  }

  return text;
}

export async function extractTextFromFile(file, onProgress) {
  const toReadableError = (err) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (/failed to fetch/i.test(msg)) {
      return new Error("OCR assets could not be downloaded. Please check your internet connection and try again.");
    }
    return err instanceof Error ? err : new Error(msg);
  };

  if (file.type === "application/pdf") {
    try {
      onProgress?.("Reading PDF text layout...");
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      let text = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        onProgress?.(`Extracting text from page ${i} of ${pdf.numPages}...`);
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = sortPdfTextItems(content.items);
        text += pageText + "\n";
      }

      const hasKeywords = /(hemoglobin|wbc|rbc|platelet|glucose|creatinine|urea|hba1c|mg\/dl|g\/dl|%)/i.test(text);

      // If PDF has no embedded text or lacks lab keywords, run high-resolution OCR on page canvas
      if (text.trim().length < 30 || !hasKeywords) {
        onProgress?.("Running high-resolution OCR on scanned PDF pages...");
        let ocrText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const scale = 2.5; // High resolution for clear digit recognition
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");

          await page.render({ canvasContext: ctx, viewport }).promise;
          enhanceImageForOCR(canvas);

          const blob = await new Promise((r) => canvas.toBlob((b) => r(b), "image/png"));
          const { data } = await Tesseract.recognize(blob, "eng", {
            logger: (m) => m.status === "recognizing text" && onProgress?.(`OCR page ${i}: ${Math.round(m.progress * 100)}%`),
          });
          ocrText += (data?.text || "") + "\n";
        }
        return ocrText.trim() ? ocrText : text;
      }
      return text;
    } catch (err) {
      throw toReadableError(err);
    }
  }

  if (file.type.startsWith("image/")) {
    try {
      onProgress?.("Preparing image for high-precision OCR...");
      const img = new Image();
      const imgUrl = URL.createObjectURL(file);
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imgUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(imgUrl);

      enhanceImageForOCR(canvas);
      const blob = await new Promise((r) => canvas.toBlob((b) => r(b), "image/png"));

      onProgress?.("Recognizing text from image...");
      const { data } = await Tesseract.recognize(blob, "eng", {
        logger: (m) => m.status === "recognizing text" && onProgress?.(`OCR: ${Math.round(m.progress * 100)}%`),
      });
      return data.text;
    } catch (err) {
      throw toReadableError(err);
    }
  }

  throw new Error("Unsupported file type. Please upload a PDF or image.");
}
