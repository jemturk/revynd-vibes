const fs = require('fs');
const path = require('path');
require('dotenv').config();

const publicToken = process.env.MAPBOX_PUBLIC_TOKEN || '';
const downloadToken = process.env.MAPBOX_DOWNLOAD_TOKEN || process.env.MAPBOX_DOWNLOADS_TOKEN || '';

function xmlEscape(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

if (!publicToken) {
  throw new Error('No MAPBOX_PUBLIC_TOKEN found in environment. The Android Mapbox string resource cannot be generated without it.');
}

const valuesDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'values');
fs.mkdirSync(valuesDir, { recursive: true });

const filePath = path.join(valuesDir, 'mapbox_strings.xml');
const contents = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <string name="mapbox_access_token">${xmlEscape(publicToken)}</string>\n  <string name="mapbox_downloads_token">${xmlEscape(downloadToken)}</string>\n</resources>\n`;

fs.writeFileSync(filePath, contents, { encoding: 'utf8' });
console.log('Wrote Android Mapbox strings to', filePath);
