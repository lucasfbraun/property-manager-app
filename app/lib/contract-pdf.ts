import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

/**
 * Builds the contract PDF that the tenant reviews and signs: the rendered
 * template text, followed (when present) by the "vistoria" photo record —
 * the property's condition at the start of the lease, embedded directly in
 * the document so the tenant's signature covers both the contract terms and
 * the photographic record (useful as evidence in a dispute/legal process).
 */

const PAGE_WIDTH = 595.28; // A4, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const TEXT_SIZE = 11;
const TEXT_LINE_HEIGHT = 16;
const HEADING_SIZE = 15;

export type InspectionPhotoInput = {
  bytes: ArrayBuffer;
  contentType: string;
  caption: string | null;
  room: string | null;
};

export async function buildContractPdf(input: {
  contractText: string;
  photos: InspectionPhotoInput[];
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  writeTextSection(pdfDoc, font, boldFont, input.contractText);

  if (input.photos.length > 0) {
    await writePhotoSection(pdfDoc, font, boldFont, input.photos);
  }

  return pdfDoc.save();
}

function sanitizeForWinAnsi(text: string): string {
  // Strips characters outside the WinAnsi range pdf-lib's standard fonts
  // support (keeps ASCII + Latin-1 Supplement, which covers Portuguese
  // accents), so an unexpected symbol/emoji never throws mid-render.
  return Array.from(text)
    .map((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code <= 0xff ? char : "?";
    })
    .join("");
}

function wrapLine(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

function writeTextSection(
  pdfDoc: PDFDocument,
  font: PDFFont,
  boldFont: PDFFont,
  contractText: string,
) {
  const maxWidth = PAGE_WIDTH - MARGIN * 2;
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function ensureSpace(lineHeight: number) {
    if (y - lineHeight < MARGIN) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  const paragraphs = sanitizeForWinAnsi(contractText).split("\n");

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === "") {
      ensureSpace(TEXT_LINE_HEIGHT);
      y -= TEXT_LINE_HEIGHT;
      continue;
    }

    const isHeading = /^CLAUSULA\b/i.test(paragraph.trim());
    const activeFont = isHeading ? boldFont : font;
    const lines = wrapLine(paragraph, activeFont, TEXT_SIZE, maxWidth);

    for (const line of lines) {
      ensureSpace(TEXT_LINE_HEIGHT);
      page.drawText(line, {
        color: rgb(0, 0, 0),
        font: activeFont,
        size: TEXT_SIZE,
        x: MARGIN,
        y,
      });
      y -= TEXT_LINE_HEIGHT;
    }
  }
}

async function writePhotoSection(
  pdfDoc: PDFDocument,
  font: PDFFont,
  boldFont: PDFFont,
  photos: InspectionPhotoInput[],
) {
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  page.drawText("Vistoria do imovel - registro fotografico", {
    color: rgb(0, 0, 0),
    font: boldFont,
    size: HEADING_SIZE,
    x: MARGIN,
    y,
  });
  y -= HEADING_SIZE + 10;

  page.drawText(
    "Fotos do estado do imovel no momento da vistoria, anexas a este contrato.",
    { color: rgb(0.3, 0.3, 0.3), font, size: 9, x: MARGIN, y },
  );
  y -= 24;

  const columns = 2;
  const gap = 16;
  const cellWidth = (PAGE_WIDTH - MARGIN * 2 - gap * (columns - 1)) / columns;
  const imageHeight = 170;
  const captionHeight = 26;
  const cellHeight = imageHeight + captionHeight;

  let column = 0;

  for (const photo of photos) {
    if (y - cellHeight < MARGIN) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
      column = 0;
    }

    const x = MARGIN + column * (cellWidth + gap);

    try {
      const embedded =
        photo.contentType === "image/png"
          ? await pdfDoc.embedPng(photo.bytes)
          : await pdfDoc.embedJpg(photo.bytes);

      const scale = Math.min(
        cellWidth / embedded.width,
        imageHeight / embedded.height,
      );
      const drawWidth = embedded.width * scale;
      const drawHeight = embedded.height * scale;

      page.drawImage(embedded, {
        height: drawHeight,
        width: drawWidth,
        x: x + (cellWidth - drawWidth) / 2,
        y: y - imageHeight + (imageHeight - drawHeight) / 2,
      });
    } catch (error) {
      console.error("[contract-pdf] falha ao inserir foto no PDF:", error);
      page.drawText("(falha ao carregar esta foto)", {
        color: rgb(0.6, 0.1, 0.1),
        font,
        size: 9,
        x,
        y: y - imageHeight / 2,
      });
    }

    const captionParts = [photo.room, photo.caption].filter(Boolean);
    const captionText = sanitizeForWinAnsi(captionParts.join(" - ")) || "-";
    page.drawText(truncateToWidth(captionText, font, 9, cellWidth), {
      color: rgb(0.2, 0.2, 0.2),
      font,
      size: 9,
      x,
      y: y - imageHeight - 14,
    });

    column += 1;
    if (column >= columns) {
      column = 0;
      y -= cellHeight + gap;
    }
  }
}

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) {
    return text;
  }
  let truncated = text;
  while (truncated.length > 1 && font.widthOfTextAtSize(`${truncated}...`, size) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}...`;
}
