import configPlugins from 'expo/config-plugins.js';
import fs from 'fs/promises';
import path from 'path';

const { withDangerousMod } = configPlugins;

function xmlEscape(value = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getMapboxStringsXml(publicToken, downloadToken) {
  return `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <string name="mapbox_access_token">${xmlEscape(publicToken)}</string>\n  <string name="mapbox_downloads_token">${xmlEscape(downloadToken || '')}</string>\n</resources>\n`;
}

export default function withMapboxStrings(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;
      const valuesDir = path.join(projectRoot, 'app', 'src', 'main', 'res', 'values');
      await fs.mkdir(valuesDir, { recursive: true });

      const publicToken = process.env.MAPBOX_PUBLIC_TOKEN;
      const downloadToken = process.env.MAPBOX_DOWNLOAD_TOKEN;
      if (!publicToken) {
        throw new Error(
          'Missing MAPBOX_PUBLIC_TOKEN. Set this environment variable before running Expo prebuild or EAS build so the Android native Mapbox access token resource can be generated.'
        );
      }

      const filePath = path.join(valuesDir, 'mapbox_strings.xml');
      await fs.writeFile(filePath, getMapboxStringsXml(publicToken, downloadToken), 'utf8');
      return config;
    },
  ]);
}
