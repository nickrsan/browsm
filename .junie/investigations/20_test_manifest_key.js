import crypto from 'crypto';

// Generate an RSA private/public key pair for deterministic extension ID
const { publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'der',
  },
});

const base64Key = publicKey.toString('base64');
console.log('Public key base64:', base64Key);

// Calculate extension ID from public key
const sha256 = crypto.createHash('sha256').update(publicKey).digest('hex');
const extId = sha256
  .slice(0, 32)
  .split('')
  .map((c) => String.fromCharCode(parseInt(c, 16) + 'a'.charCodeAt(0)))
  .join('');

console.log('Deterministic Extension ID:', extId);
