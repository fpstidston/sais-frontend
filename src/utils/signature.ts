import { decryptPrivateKeyForSigning, exportKeyAsBase64 } from "./keyManager"
import { bufferToBase64, encodeUTF8 } from "./helpers"

export async function signChallengeForLogin(
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

export async function signChallengeForServer(
    challenge: string,
    decryptedPrivateKey: CryptoKey
): Promise<{ signature: ArrayBuffer, challengeAndKeyString: string }> {
    const challengePayload = {
        challenge //un-nest this later on front and back end
    }
    const challengeString = JSON.stringify(challengePayload)
    const challengeBytes = encodeUTF8(challengeString)
    
    const signature = await crypto.subtle.sign(
        { name: "RSASSA-PKCS1-v1_5"},
        decryptedPrivateKey, 
        challengeBytes
    )

    return { signature, challengeAndKeyString: challengeString }
}
// export async function verifySignature(challenge: string, signature: ArrayBuffer, publicKey: CryptoKey): boolean
