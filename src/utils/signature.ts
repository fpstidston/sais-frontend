import { decryptPrivateKeyForSigning } from "./keyManager"
import { base64ToUint8Array } from "./helpers"

export async function signChallenge(
    challenge: string,
    encryptedPrivateKeyB64: string,
    password: string, 
    salt: Uint8Array,
    iv: Uint8Array
    ): Promise<ArrayBuffer> {
    const decryptedPrivateKey = await decryptPrivateKeyForSigning(encryptedPrivateKeyB64, password, salt, iv)
    const challengeEncoder = new TextEncoder()
    const challengeBuffer = challengeEncoder.encode(challenge)
    return crypto.subtle.sign(
        {
            name: "RSASSA-PKCS1-v1_5"
        },
        decryptedPrivateKey,
        challengeBuffer
    )
}
// export async function verifySignature(challenge: string, signature: ArrayBuffer, publicKey: CryptoKey): boolean
