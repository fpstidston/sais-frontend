import { encryptPrivateKey, generateKeyPair } from './keyManager'
import { bufferToBase64 } from './helpers'

export async function prepareUserKeyBundle(password) {
    const { publicKey, privateKey } = await generateKeyPair()
    const publicKeyBuffer = await crypto.subtle.exportKey(
        'spki',
        publicKey
    )
    const { encryptedPrivateKey, salt, iv } = await encryptPrivateKey(privateKey, password)
    debugger
    return {
        publicKey: bufferToBase64(publicKeyBuffer),
        encryptedPrivateKey: bufferToBase64(encryptedPrivateKey),
        salt: bufferToBase64(salt),
        iv: bufferToBase64(iv)
    }
}
export async function encryptAndSendMessage(message: string, serverPublicKey: CryptoKey): { encryptedMessage, encryptedKey }
export async function receiveAndDecryptMessage(encryptedMessage: ArrayBuffer, encryptedKey: ArrayBuffer, userPassword: string): string