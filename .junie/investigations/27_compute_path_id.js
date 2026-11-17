import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToExtension = path.resolve(__dirname, '../../.output/chrome-mv3');

// In Chromium, unpacked extension ID from path:
const hash = crypto.createHash('sha256').update(pathToExtension).digest('hex');
const extId = hash
  .slice(0, 32)
  .split('')
  .map((c) => String.fromCharCode(parseInt(c, 16) + 'a'.charCodeAt(0)))
  .join('');

console.log('Path:', pathToExtension);
console.log('Computed Extension ID from path:', extId);
