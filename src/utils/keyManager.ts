import { deriveKeyForKeyBundle } from "./passwordCrypto"
import { base64ToUint8Array, bufferToBase64, cleanPem, decryptPrivateKeyBuffer, deriveKeyForDecryption } from "./helpers"

export async function generateKeyPair() {
    return await crypto.subtle.generateKey(
        {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256"
        },
        true,
        ["encrypt", "decrypt"]
    )
}
export async function importPublicKey(key: string): Promise<CryptoKey> {
    // const pemString = atob(key) // consider updating server to avoid double encoding
    const cleaned = cleanPem(key)
    const binaryDer = base64ToUint8Array(cleaned)
    return crypto.subtle.importKey(
        "spki",
        binaryDer.buffer,
        {
            name: "RSA-OAEP",
            hash: "SHA-256"
        },
        true,
        ["encrypt"]
    )
}
export async function importPrivateKeyForSigning(key: string, derivedKey:CryptoKey, iv: ArrayBuffer): Promise<CryptoKey> {
    const decryptedPrivateKeyBuffer = await decryptPrivateKeyBuffer(key, iv, derivedKey)
    return crypto.subtle.importKey(
        "pkcs8",
        decryptedPrivateKeyBuffer,
        {
            name: "RSASSA-PKCS1-v1_5",
            hash: "SHA-256"
        },
        true,
        ["sign"]
    )
}
export async function importPrivateKeyForMessage(key: string, derivedKey: CryptoKey, iv: ArrayBuffer): Promise<CryptoKey> {
    const decryptedPrivateKeyBuffer = await decryptPrivateKeyBuffer(key, iv, derivedKey)
    return crypto.subtle.importKey(
        "pkcs8",
        decryptedPrivateKeyBuffer,
        {
            name: "RSA-OAEP",
            hash: "SHA-256"
        },
        true,
        ["decrypt"]
    )
}
export async function encryptPrivateKey(privateKey: CryptoKey, password: string) {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const derivedKey = await deriveKeyForKeyBundle(password, salt)
    const privateKeyBuffer = await crypto.subtle.exportKey(
        'pkcs8',
        privateKey
    )
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encryptedPrivateKey = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        derivedKey, 
        privateKeyBuffer
    )
    return {
        encryptedPrivateKey,
        salt, 
        iv
    }
}
export async function decryptPrivateKey(encryptedPrivateKey: string, password: string, salt: Uint8Array, iv: Uint8Array) {
    const derivedKey = await deriveKeyForDecryption(password, salt);

    const encryptedKeyBytes = base64ToUint8Array(encryptedPrivateKey)
    const decryptedKeyBuffer = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv
        },
        derivedKey,
        encryptedKeyBytes
    )

    return await crypto.subtle.importKey(
        "pkcs8",
        decryptedKeyBuffer,
        {
            name: "RSASSA-PKCS1-v1_5",
            hash: "SHA-256"
        },
        false,
        ["sign"]
    )
}

export async function decryptPrivateKeyForSigning(encryptedKey: string, password: string, salt: Uint8Array, iv: ArrayBuffer): Promise<CryptoKey> {
    const derivedKey = await deriveKeyForDecryption(password, salt)
    return importPrivateKeyForSigning(encryptedKey, derivedKey, iv) 
}
export async function decryptPrivateKeyForMessage(encryptedKey: string, password: string, salt: Uint8Array, iv: ArrayBuffer): Promise<CryptoKey> {
    const derivedKey = await deriveKeyForDecryption(password, salt)
    return importPrivateKeyForMessage(encryptedKey, derivedKey, iv) 
}
export async function exportKeyAsBase64(cryptoKey: CryptoKey) {
    const rawKey = await crypto.subtle.exportKey("raw", cryptoKey)
    return bufferToBase64(rawKey)
}