import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { sanitizeForWinAnsi, wrapLine } from "./contract-pdf";

/**
 * Fixed placeholder text for the payment receipt, per explicit request.
 * TODO: replace with real per-charge data (amount, tenant, receiver,
 * property, payment date/method) once the template is approved.
 */
const RECEIPT_TEXT = `RECIBO DE PAGAMENTO DE ALUGUEL

No do Recibo: 001/2026
Valor: R$ 0.000,00 (Valor por extenso)
Referente a: Aluguel de imovel referente ao mes de [Mes/Ano]

DADOS DO LOCATARIO (Inquilino):
- Nome Completo: [Nome do Inquilino]
- CPF / CNPJ: [000.000.000-00]

DADOS DO LOCADOR (Proprietario ou Imobiliaria):
- Nome Completo / Razao Social: [Nome do Locador ou Imobiliaria]
- CPF / CNPJ: [000.000.000-00]

DISCRIMINACAO DOS VALORES:
- Aluguel Liquido: R$ 0.000,00
- Condominio: R$ 0.000,00
- IPTU: R$ 0.000,00
- Outras Taxas: R$ 0.000,00
- Valor Total Pago: R$ 0.000,00

DADOS DO IMOVEL:
- Endereco Completo: [Rua, Numero, Complemento, Bairro, CEP]
- Cidade / Estado: [Cidade] / [Estado]

FORMA DE PAGAMENTO:
( ) PIX  ( ) Transferencia Bancaria  ( ) Dinheiro  ( ) Boleto

Declaro para os devidos fins que recebi a quantia acima discriminada e dou
total quitacao da referida obrigacao, estando o locatario quite com suas
obrigacoes contratuais referentes ao periodo citado.

[Cidade - SC], [Dia] de [Mes] de [Ano]`;

const PAGE_WIDTH = 595.28; // A4, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const TEXT_SIZE = 11;
const TEXT_LINE_HEIGHT = 16;
const HEADING_SIZE = 16;

/**
 * Builds the payment receipt PDF. Content is fixed/placeholder for now (see
 * RECEIPT_TEXT above) regardless of which charge it's generated for.
 */
export async function buildReceiptPdf(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const maxWidth = PAGE_WIDTH - MARGIN * 2;
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function ensureSpace(lineHeight: number) {
    if (y - lineHeight < MARGIN) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  const paragraphs = sanitizeForWinAnsi(RECEIPT_TEXT).split("\n");
  let isFirstLine = true;

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === "") {
      ensureSpace(TEXT_LINE_HEIGHT);
      y -= TEXT_LINE_HEIGHT;
      continue;
    }

    const isTitle = isFirstLine;
    const isSectionHeading = /^[A-Z][A-Z\s()/]+:?$/.test(paragraph.trim()) && !isTitle;
    const activeFont = isTitle || isSectionHeading ? boldFont : font;
    const size = isTitle ? HEADING_SIZE : TEXT_SIZE;
    const lines = wrapLine(paragraph, activeFont, size, maxWidth);

    for (const line of lines) {
      ensureSpace(TEXT_LINE_HEIGHT);
      page.drawText(line, {
        color: rgb(0, 0, 0),
        font: activeFont,
        size,
        x: MARGIN,
        y,
      });
      y -= isTitle ? TEXT_LINE_HEIGHT + 6 : TEXT_LINE_HEIGHT;
    }

    isFirstLine = false;
  }

  return pdfDoc.save();
}
