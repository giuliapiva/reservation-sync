// airbnb-browser-fetch.js
import fs from 'fs/promises';
import fetch from 'node-fetch';
import path from 'path';

const url = process.argv[2];
const outPath = path.join('ics', 'airbnb.ics');

const headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Accept': 'text/calendar,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection': 'keep-alive',
};

console.log('🌐 Trying browser-like download...');

try {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.error(`❌ Browser fetch failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  const text = await res.text();
  await fs.mkdir('ics', { recursive: true });
  await fs.writeFile(outPath, text, 'utf-8');
  console.log(`✅ Saved Airbnb .ics (browser) to ${outPath}`);
} catch (err) {
  console.error('❌ Error in browser fetch:', err.message);
  process.exit(1);
}