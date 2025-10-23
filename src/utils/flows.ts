import { encryptPrivateKey, generateKeyPair, importPublicKey } from './keyManager'
import { bufferToBase64 } from './helpers'
import { encryptMessage, encryptMessageKey, generateMessageKey } from './messageCrypto'

export async function prepareUserKeyBundle(password) {
    const { publicKey, privateKey } = await generateKeyPair()
    const publicKeyBuffer = await crypto.subtle.exportKey(
        'spki',
        publicKey
    )
    const { encryptedPrivateKey, salt, iv } = await encryptPrivateKey(privateKey, password)
    return {
        publicKey: bufferToBase64(publicKeyBuffer),
        encryptedPrivateKey: bufferToBase64(encryptedPrivateKey),
        salt: bufferToBase64(salt),
        iv: bufferToBase64(iv)
    }
}
export async function encryptMessageForSend(message: string, serverPublicKeyB64: string, clientPublicKeyB64: string): Promise<{ encryptedMessage, encryptedKeyServer, encryptedKeyClient }> {
    const serverPublicKey = await importPublicKey(serverPublicKeyB64)
    const clientPublicKey = await importPublicKey(clientPublicKeyB64)
    const messageKey = await generateMessageKey()
    const encryptedMessage = await encryptMessage(message, messageKey)
    const encryptedKeyServer = await encryptMessageKey(messageKey, serverPublicKey)
    const encryptedKeyClient = await encryptMessageKey(messageKey, clientPublicKey)
    return {
        encryptedMessage, 
        encryptedKeyServer,
        encryptedKeyClient
    }
}
export async function decryptMessageOnReceive(encryptedMessage: ArrayBuffer, encryptedKey: ArrayBuffer, userPassword: string): string