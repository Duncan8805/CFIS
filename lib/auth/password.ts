// 密碼雜湊：PBKDF2-SHA256（Web Crypto，Workers 與 Node 都能用）。
// Workers 的 PBKDF2 迭代次數上限是 100,000。
// 存放格式：pbkdf2$<迭代次數>$<salt base64>$<hash base64>

const ITERATIONS = 100_000;
const KEY_BYTES = 32;

const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, saltText, hashText] = stored.split("$");
  if (scheme !== "pbkdf2" || !iter || !saltText || !hashText) return false;
  const expected = fromBase64(hashText);
  const actual = await derive(password, fromBase64(saltText), Number(iter));
  if (actual.length !== expected.length) return false;
  // 固定時間比較，避免從回應時間推測密碼
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export const MIN_PASSWORD_LENGTH = 8;
