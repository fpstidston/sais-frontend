// signature.ts
export async function signChallenge(challenge: string, privateKey: CryptoKey): ArrayBuffer
export async function verifySignature(challenge: string, signature: ArrayBuffer, publicKey: CryptoKey): boolean
