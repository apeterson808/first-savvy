import * as pdfjsLib from 'pdfjs-dist';
import { readFileSync } from 'fs';

const data = readFileSync('./data/statements/amex_dec.pdf');

const loadingTask = pdfjsLib.getDocument({ data });
const pdf = await loadingTask.promise;

let text = '';

for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
  const page = await pdf.getPage(pageNum);
  const textContent = await page.getTextContent();
  const pageText = textContent.items.map(item => item.str).join(' ');
  text += pageText + '\n';
}

console.log('=== EXTRACTED TEXT ===');
console.log(text);
console.log('\n=== FIRST 2000 CHARACTERS ===');
console.log(text.substring(0, 2000));
console.log('\n=== INCLUDES CHECKS ===');
console.log('Includes "american express":', text.toLowerCase().includes('american express'));
console.log('Includes "delta skymiles":', text.toLowerCase().includes('delta skymiles'));
console.log('Includes "Payments":', text.includes('Payments'));
console.log('Includes "New Charges":', text.includes('New Charges'));
