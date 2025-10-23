// messageCrypto.ts
export async function generateMessageKey(): CryptoKey
export async function encryptMessage(message: string, key: CryptoKey): ArrayBuffer
export async function decryptMessage(encrypted: ArrayBuffer, key: CryptoKey): string
export async function encryptMessageKey(messageKey: CryptoKey, recipientPublicKey: CryptoKey): ArrayBuffer
export async function decryptMessageKey(encryptedKey: ArrayBuffer, privateKey: CryptoKey): CryptoKey
