// Test helper: extracts the visible text of a PDF (per page) so assertions read what a customer would read,
// not raw PDF bytes (the invoice embeds a subset font, so text is not greppable in the file).
export async function extractPdfText(buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: false, verbosity: 0 }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((it) => it.str).join(" ").replace(/\s+/g, " ").trim());
  }
  return { pages, text: pages.join("\n"), pageCount: doc.numPages };
}
