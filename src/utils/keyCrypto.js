// #29: Optional passphrase encryption-at-rest for the stored LLM settings.
// WebCrypto only (no deps): PBKDF2-SHA256 derives an AES-256-GCM key from the
// passphrase; a random salt + IV are stored alongside the ciphertext. The
// passphrase and derived key are never persisted — decryption happens in memory
// per session. This defeats at-rest theft (stolen disk / copied storage), NOT
// same-context code execution; see the threat notes on issue #9/#29.

const PBKDF2_ITERATIONS = 210000; // OWASP-recommended floor for PBKDF2-SHA256
const BLOB_VERSION = 1;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(passphrase, salt, iterations) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Encrypt a string with a passphrase. Returns a JSON string holding only
// non-secret material ({ v, iterations, salt, iv, ciphertext } as base64).
export async function encryptString(plaintext, passphrase) {
  if (!passphrase) throw new Error("passphrase required");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );
  return JSON.stringify({
    v: BLOB_VERSION,
    iterations: PBKDF2_ITERATIONS,
    salt: bufToBase64(salt),
    iv: bufToBase64(iv),
    ciphertext: bufToBase64(ciphertext),
  });
}

// Decrypt a blob produced by encryptString. Throws on a wrong passphrase or
// tampered data (AES-GCM authentication failure).
export async function decryptString(blob, passphrase) {
  const parsed = typeof blob === "string" ? JSON.parse(blob) : blob;
  const key = await deriveKey(
    passphrase,
    base64ToBytes(parsed.salt),
    parsed.iterations || PBKDF2_ITERATIONS
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(parsed.iv) },
    key,
    base64ToBytes(parsed.ciphertext)
  );
  return decoder.decode(plaintext);
}

// True if the given string looks like one of our encryption blobs.
export function isEncryptedBlob(value) {
  if (typeof value !== "string") return false;
  try {
    const p = JSON.parse(value);
    return (
      p && typeof p === "object" && p.v === BLOB_VERSION && !!p.ciphertext && !!p.salt && !!p.iv
    );
  } catch {
    return false;
  }
}
