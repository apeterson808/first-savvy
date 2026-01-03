import { readFileSync } from 'fs';
import { PDFParse } from 'pdf-parse';

const pdfPath = './public/statements/iccu_sep.pdf';
const dataBuffer = readFileSync(pdfPath);
const parser = new PDFParse({ data: dataBuffer, verbosity: 0 });
const data = await parser.getText();

const text = data.text.toLowerCase();

console.log('Contains "idaho central":', text.includes('idaho central'));
console.log('Contains "iccu":', text.includes('iccu'));
console.log('Contains "citi":', text.includes('citi'));
console.log('Contains "american express":', text.includes('american express'));
console.log('Contains "amex":', text.includes('amex'));

console.log('\nFirst 500 chars:');
console.log(data.text.substring(0, 500));
