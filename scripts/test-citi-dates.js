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

  let allText = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    allText += pageText + '\n';
  }

  console.log('=== Searching for Billing Period ===\n');

  const billingMatch = allText.match(/Billing\s+Period[:\s]+(\d{2}\/\d{2}\/\d{2,4})\s*-\s*(\d{2}\/\d{2}\/\d{2,4})/i);
  console.log('Billing Period Match:', billingMatch);

  if (billingMatch) {
    console.log('Start Date:', billingMatch[1]);
    console.log('End Date:', billingMatch[2]);
  }

  const allLines = allText.split('\n');
  const billingLines = allLines.filter(line => line.toLowerCase().includes('billing'));
  console.log('\n=== Lines containing "billing" ===');
  billingLines.slice(0, 10).forEach(line => console.log(line));
}

main().catch(console.error);
