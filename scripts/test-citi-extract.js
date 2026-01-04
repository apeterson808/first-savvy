import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

pdfjsLib.GlobalWorkerOptions.workerSrc = join(__dirname, '../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');

async function main() {
  const filePath = join(__dirname, '../data/statements', 'citi_dec.pdf');
  const buffer = readFileSync(filePath);
  const data = new Uint8Array(buffer);
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  console.log(`Total pages: ${pdf.numPages}\n`);

  let allLines = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    const pageLines = pageText.split(/\s{2,}/).map(line => line.trim()).filter(line => line.length > 0);
    allLines.push(...pageLines);
  }

  console.log('=== Sample Lines ===\n');
  const paymentsIndex = allLines.findIndex(line => line.includes('Payments, Credits and Adjustments'));
  const purchasesIndex = allLines.findIndex(line => line.includes('Standard Purchases'));

  console.log(`Payments section starts at line ${paymentsIndex}:`);
  if (paymentsIndex >= 0) {
    allLines.slice(paymentsIndex, Math.min(paymentsIndex + 10, allLines.length)).forEach((line, i) => {
      console.log(`${paymentsIndex + i}: ${line}`);
    });
  }

  console.log(`\nPurchases section starts at line ${purchasesIndex}:`);
  if (purchasesIndex >= 0) {
    allLines.slice(purchasesIndex, Math.min(purchasesIndex + 20, allLines.length)).forEach((line, i) => {
      console.log(`${purchasesIndex + i}: ${line}`);
    });
  }
}

main().catch(console.error);
