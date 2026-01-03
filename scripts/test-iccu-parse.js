import { readFileSync } from 'fs';
import { PDFParse } from 'pdf-parse';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testParse() {
  const filePath = join(__dirname, '..', 'public', 'iccu_dec copy.pdf');
  const dataBuffer = readFileSync(filePath);
  const parser = new PDFParse({ data: dataBuffer, verbosity: 0 });
  const data = await parser.getText();
  const text = data.text;

  const lines = text.split('\n');

  const savingsHeaderIndex = lines.findIndex(line =>
    line.includes('SHARE SAVINGS - PERSONAL SAVINGS')
  );

  const checkingHeaderIndex = lines.findIndex(line =>
    line.includes('CENTRAL CHECKING - MAIN CHECKING')
  );

  console.log('Savings starts at line:', savingsHeaderIndex);
  console.log('Checking starts at line:', checkingHeaderIndex);
  console.log('\nSavings section (first 30 lines):');
  console.log('='.repeat(80));
  lines.slice(savingsHeaderIndex, savingsHeaderIndex + 30).forEach((line, i) => {
    console.log(`${savingsHeaderIndex + i}: ${line}`);
  });
}

testParse().catch(console.error);
