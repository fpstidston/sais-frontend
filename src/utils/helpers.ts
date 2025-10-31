export function base64ToUint8Array(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

export function bufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

export function cleanPem(pem) {
  return pem
    .replace(/-----BEGIN PUBLIC KEY-----/, "")
    .replace(/-----END PUBLIC KEY-----/, "")
    .replace(/\s+/g, "")
}

export async function decryptPrivateKeyBuffer(
  key: string,
  iv: Uint8Array,
  derivedKey: CryptoKey
): Promise<ArrayBuffer> {
    const encryptedKeyBuffer = base64ToUint8Array(key)
    const ivBuffer = iv
    const k = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: ivBuffer
        }, 
        derivedKey, 
        encryptedKeyBuffer
    )
    return k
}

export async function deriveKeyForDecryption(password: string, salt: Uint8Array) {
    const encoder = new TextEncoder()
    const passwordKey = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    )
    const k = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt, 
            iterations: 100000,
            hash: "SHA-256"
        },
        passwordKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    )
    return k
}

export function base64encode(string: string) {
    return btoa(string)
}

export function base64decode(string: string) {
    return atob(string)
}

export function encodeUTF8(string: string) {
    const encoder = new TextEncoder()
    return encoder.encode(string)
}