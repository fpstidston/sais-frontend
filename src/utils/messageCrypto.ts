import { base64ToUint8Array, bufferToBase64, encodeUTF8 } from "./helpers.ts"

// messageCrypto.ts
export async function generateMessageKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
        {
            name: "AES-GCM",
            length: 256
        },
        true,
        ["encrypt", "decrypt"]
    )
}
export async function encryptMessage(message: string, key: CryptoKey): Promise<{ ciphertext: ArrayBuffer, iv: Uint8Array }> {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encoded = new TextEncoder().encode(message)
    const ciphertext = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv
        },
        key, 
        encoded
    )
    return { ciphertext, iv}
}
export async function decryptUserMessage(
    encryptedBody: string,
    encryptedKey: string,
    iv: string,
    privateKey: CryptoKey
): Promise<string>  {
    const encryptedBodyBuffer = base64ToUint8Array(encryptedBody).buffer
    const encryptedKeyBuffer = base64ToUint8Array(encryptedKey).buffer
    const ivBuffer = base64ToUint8Array(iv).buffer
    const aesKey = await decryptMessageKey(encryptedKeyBuffer, privateKey) 
    const decryptedBuffer = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: ivBuffer
        },
        aesKey,
        encryptedBodyBuffer
    )
    const decoder = new TextDecoder()
    return decoder.decode(decryptedBuffer)
}
export async function encryptMessageKey(
    messageKey: CryptoKey,
    publicKey: CryptoKey,
): Promise<ArrayBuffer> {
    const rawKey = await crypto.subtle.exportKey("raw", messageKey)
    const encryptedKey = await crypto.subtle.encrypt(
        {
            name: "RSA-OAEP"
        },
        publicKey,
        rawKey
    )
    return encryptedKey
}
export async function decryptMessageKey(encryptedKey: ArrayBuffer, privateKey: CryptoKey): Promise<CryptoKey> {
    // debugger
    const aesKeyRaw = await crypto.subtle.decrypt(
        {
            name: "RSA-OAEP"
        },
        privateKey,
        encryptedKey
    )
    return crypto.subtle.importKey(
        "raw",
        aesKeyRaw,
        {
            name: "AES-GCM",
        },
        false, 
        ["decrypt"]
    )
}
export function generateServerChallenge() {
    const nonce = crypto.getRandomValues(new Uint8Array(32))
    const nonceB64 = bufferToBase64(nonce)

    const challenge = {
        nonce: nonceB64,
        messageId: 0
    }

    const challengeString = JSON.stringify(challenge)

    return {
        challenge, 
        challengeString
    }
}
export async function deriveServerWrappedKey(challengeString:string, signature: ArrayBuffer): Promise<{ wrappingKey: CryptoKey, salt: Uint8Array }> {
    const challengeHash = await crypto.subtle.digest("SHA-256", encodeUTF8(challengeString))
    const signatureKey = await crypto.subtle.importKey(
        "raw",
        signature, 
        { 
            name: "HMAC", 
            hash: "SHA-256"
        },
        false,
        ["sign"]
    )
    const hmacInput = await crypto.subtle.sign("HMAC", signatureKey, challengeHash)

    const salt = new Uint8Array(32)
    crypto.getRandomValues(salt)

    const baseKey = await crypto.subtle.importKey(
        "raw",
        hmacInput, 
        { name: "HKDF"},
        false,
        ["deriveKey"]
    )
    const wrappingKey = await crypto.subtle.deriveKey(
        {
            name: "HKDF",
            hash: "SHA-256",
            salt: salt,
            info: encodeUTF8("server-wrap-key")
        },
        baseKey,
        { name: "AES-GCM", length: 256 },
        true, 
        ["encrypt", "decrypt", "wrapKey"]
    )

    return { wrappingKey, salt }
}