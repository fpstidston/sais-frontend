export async function deriveKeyForKeyBundle(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder()
    const passwordKey = await crypto.subtle.importKey(
        "raw", 
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    )
    const derivedKey = crypto.subtle.deriveKey(
        {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256"
        },
        passwordKey,
        {
        name: "AES-GCM",
        length: 256
        },
        true,
        ["encrypt", "decrypt"]
    )
    return derivedKey
}
// export async function encryptWithDerivedKey(data: ArrayBuffer, key: CryptoKey, iv: Uint8Array): ArrayBuffer
// export async function decryptWithDerivedKey(encrypted: ArrayBuffer, key: CryptoKey, iv: Uint8Array): ArrayBuffer
