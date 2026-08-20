// Base64 helpers shared by every writer (q-sort, q-write).
// btoa() takes a "binary string" (one byte per code unit), so UTF-8 text
// must be encoded to bytes first.

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return (globalThis as { btoa: (s: string) => string }).btoa(binary);
}

export function utf8Base64(s: string): string {
  return bytesToBase64(new TextEncoder().encode(s));
}

export function base64ToUtf8(b64: string): string {
  const binary = (globalThis as { atob: (s: string) => string }).atob(b64.replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
