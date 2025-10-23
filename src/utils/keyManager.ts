import { deriveKeyFromPassword } from "./passwordCrypto"
import { base64ToUint8Array } from "./helpers"

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
export async function importPublicKey(pem: string): CryptoKey
export async function importPrivateKey(encryptedPrivateKey: string): CryptoKey {
    const derivedKey = deriveKeyFromPassword()
    const decryptedPrivateKeyBuffer = await crypto.subtle.decrypt(
        {
        name: "AES-GCM",
        iv
        }, 
        derivedKey, 
        encryptedPrivateKey
    )
    return await crypto.subtle.importKey(
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
export async function encryptPrivateKey(privateKey, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const derivedKey = await deriveKeyFromPassword(password, salt)
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
export async function decryptPrivateKey(encryptedKey: ArrayBuffer, password: string, salt: Uint8Array, iv: ArrayBuffer): CryptoKey {
    const encoder = new TextEncoder()
    const passwordKey = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    )
    const derivedKey = await crypto.subtle.deriveKey(
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
    console.log(derivedKey)
    console.log(encryptedKey)
    const decryptedPrivateKeyBuffer = await crypto.subtle.decrypt(
        {
        name: "AES-GCM",
        iv
        }, 
        derivedKey, 
        encryptedKey
    )
    const decryptedPrivateKey = await crypto.subtle.importKey(
        "pkcs8",
        decryptedPrivateKeyBuffer,
        {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256"
        },
        true,
        ["sign"]
    )
    return decryptedPrivateKey
}
