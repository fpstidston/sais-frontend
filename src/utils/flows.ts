import { encryptPrivateKey, generateKeyPair, importPublicKey } from './keyManager'
import { bufferToBase64 } from './helpers'
import { encryptMessage, encryptMessageKey, generateMessageKey, deriveServerWrappedKey, generateServerChallenge } from './messageCrypto'
import { signChallengeForServer } from './signature'

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
export async function encryptMessageForSend(message: string, decryptedPrivateKey: CryptoKey, clientPublicKeyB64: string) {
    const { challenge, challengeString } = generateServerChallenge()
    const { signature: signatureBuffer, challengeAndKeyString } = await signChallengeForServer(challengeString, decryptedPrivateKey)
    const { salt, wrappingKey } = await deriveServerWrappedKey(challengeString, signatureBuffer)

    const messageKey = await generateMessageKey()
    const encryptedMessage = await encryptMessage(message, messageKey)

    const iv = crypto.getRandomValues(new Uint8Array(12))
    // const rawMessageKey = await crypto.subtle.exportKey("raw", messageKey)
    const wrappedKeyServer = await crypto.subtle.wrapKey(
        "raw",
        messageKey, 
        wrappingKey,
        { name: "AES-GCM", iv }
    )

    // const rawMessageKey = await crypto.subtle.exportKey("raw", messageKey)
    // const bytes = new Uint8Array(rawMessageKey)
    // const binary = bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), "")
    // console.log('messageKey', btoa(binary))
    
    const signature = bufferToBase64(signatureBuffer)

        // console.log(Array.from(new Uint8Array(rawMessageKey))
        // .map(b => b.toString(16).padStart(2, '0')).join(''))

    const clientPublicKey = await importPublicKey(clientPublicKeyB64)
    const encryptedKeyClient = await encryptMessageKey(messageKey, clientPublicKey)



    return {
        encryptedMessage, 
        wrappedKeyServer,
        encryptedKeyClient,
        challengeString: challengeAndKeyString,
        signature,
        salt, 
        iv_wrap: iv
    }
}
export async function decryptMessageOnReceive(encryptedMessage: ArrayBuffer, encryptedKey: ArrayBuffer, userPassword: string): string