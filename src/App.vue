<script setup>
import axios from 'axios';
import { ref, computed } from 'vue';
import { prepareUserKeyBundle, encryptMessageForSend } from './utils/flows';
import { importPublicKey, decryptPrivateKeyForMessage } from './utils/keyManager';
import { base64ToUint8Array, bufferToBase64 } from './utils/helpers';
import { decryptUserMessage } from './utils/messageCrypto';
import { signChallenge } from './utils/signature'
import { marked } from 'marked'

const baseURL = 'http://localhost:5000'
const email = defineModel('email', { required: true, default: 'fpstidston@proton.me' })
const password = defineModel('password', { required: true, default: 'test' })
const message = defineModel('message', { required: true })
const formBusy = ref(false)
const isLoggedIn = ref(false)
const hasEnteredEmail = ref(false)
const messages = ref([])
const responses = ref([])
let publicKeyB64
let serverPublicKeyB64
let encryptedPrivateKeyB64
let decryptedPrivateKey
let salt
let challenge
let iv

const conversation = computed({
  get() {
    return [...messages.value, ...responses.value].sort((a, b) => a.datetime - b.datetime).reverse()
  }
})

const handleSignup = async () => {
  if (!email.value) return
  if (!password.value) return

  formBusy.value = true
  const { publicKey, encryptedPrivateKey, salt, iv } = await prepareUserKeyBundle(password.value)
  axios.post(baseURL + '/user/create', {
    username: email.value,
    public_key: publicKey,
    encrypted_private_key: encryptedPrivateKey,
    salt,
    iv
  }, { withCredentials: true })
    .catch(err => {
      console.log('Error creating account', err)
    }) 
    .finally(() => {
      formBusy.value = false
    })
}

const handleLogin = () => {
  if (!hasEnteredEmail.value) {
    handleLoginStart()
  } else {
    handleLoginFinish()
  }
}

const handleLoginStart = () => {
  formBusy.value = true
  axios.post(baseURL + '/key/get-public', {
    username: email.value,
  }, { withCredentials: true })
    .then(response => {
      hasEnteredEmail.value = true
      publicKeyB64 = response.data.public_key
      encryptedPrivateKeyB64 = response.data.encrypted_private_key
      salt = base64ToUint8Array(response.data.salt)
      iv = base64ToUint8Array(response.data.iv)
      challenge = response.data.challenge
    })
    .catch(err => {
      console.log('Error logging in', err)
    }) 
    .finally(() => {
      formBusy.value = false
    })
}

const handleLoginFinish = async () => {
  formBusy.value = true
  const signature = await signChallenge(challenge, encryptedPrivateKeyB64, password.value, salt, iv)
  axios.post(baseURL + '/user/verify-login', {
    username: email.value,
    signature: bufferToBase64(signature),
    challenge
  }, { withCredentials: true })
    .then(async response => {
      if (response.data.logged_in == true) {
        isLoggedIn.value = true
        serverPublicKeyB64 = response.data.server_public_key
        decryptedPrivateKey = await decryptPrivateKeyForMessage(encryptedPrivateKeyB64, password.value, salt, iv)
        axios.get(baseURL + '/message/list', { withCredentials: true })
          .then(async response => {
            messages.value = await decryptMessages(response.data.messages)
          })
          .catch(err => {
            console.log('Error loading messages', err)
          }) 
      } else {
        console.log('Error logging in')
      }
    })
    .catch(err => {
      console.log('Error logging in', err)
    }) 
    .finally(() => {
      formBusy.value = false
    })
}

const handleSend = async () => {
  formBusy.value = true
  const { encryptedMessage, encryptedKeyClient, encryptedKeyServer } = await encryptMessageForSend(message.value, serverPublicKeyB64, publicKeyB64)
  axios.post(baseURL + '/message/create', {
    encrypted_key_server: bufferToBase64(encryptedKeyServer),
    encrypted_key_client: bufferToBase64(encryptedKeyClient),
    encrypted_message: bufferToBase64(encryptedMessage.ciphertext),
    iv: bufferToBase64(encryptedMessage.iv)
  }, { withCredentials: true })
    .then(async response => {
      messages.value.push({
        sender: 'You',
        body: message.value,
        datetime: new Date().toUTCString()
      })
      message.value = ''
      console.log(response.data.response)
      debugger
      const encrpytedReply = response.data.response
      const replies = await decryptMessages([encrpytedReply])
      const reply = replies[0]
      responses.value.push({
        sender: 'Server',
        body: reply.body,
        datetime: new Date().toUTCString()
      })
    })
    .catch(err => {
      console.log('Error sending message')
    })
    .finally(() => {
      formBusy.value = false
    })
}

const decryptMessages = async (messages) => {
  for(const message of messages) {
    message.body = await decryptUserMessage(
      message.encrypted_body,
      message.encrypted_key_client,
      message.iv,
      decryptedPrivateKey
    )
  }
  return messages
}

</script>

<template>
  <div>
    <div v-if="formBusy">
      Please wait...
    </div>
    <template v-else>
      <form v-if="!isLoggedIn">
        <h2>Sign up</h2>
        <input type="email" v-model="email" />
        <input type="password" v-model="password"/>
        <button @click="handleSignup">Sign up</button>
        <h2>Log in</h2>
        <input type="email" v-if="!hasEnteredEmail" v-model="email" />
        <input type="password" v-if="hasEnteredEmail" v-model="password"/>
        <button @click="handleLogin">Log in</button>
      </form>
      <template v-else>
        <form>
          <label>Message</label>
          <textarea v-model="message" />
          <button @click="handleSend">Send</button>
        </form>
        <h2>List of messages</h2>
        <div class="message" v-for="message in conversation">
          <span class="date">{{ message.datetime }}</span>
          <div class="sender"><strong>{{  message.sender }}</strong></div>
          <div v-html="marked.parse(message.body)" />
        </div>
      </template>
      <h2>Security aims</h2>
      <ul>
        <li>Zero-knowledge hyrbid encyption messaging
          <ul>
            <li>✓ User generates public/private key pair</li>
            <li>✓ User password is used to genereate a strong key</li>
            <li>✓ Strong key is used to encrypt the private key</li>
            <li>✓ Server receives and stores public key, and encrypted private key</li>
            <li>✓ User signs a challenge using their private key</li>
            <li>✓ Server uses users public_key to verify the signature</li>
            <li>✓ User writes and encrypts a message using a new message key</li>
            <li>✓ User message key is encrypted using server and client public keys</li>
            <li>✓ Server receives encrypted message and encrypted keys</li>
            <li>✓ Server decrypts message key using its private key</li>        
            <li>✓ Server generates a reply and a new message key</li>
            <li>✓ Server encrypts reply with the message key</li>
            <li>✓ Server encrypts the message key using server and client public keys</li>
            <li>✓ User decrypts their private key using their password</li>
            <li>✓ User signs challenge from server using private key</li>
            <li>✓ User decrypts the message key using their private key</li>
            <li>✓ User decrypts the message using the message key</li>
          </ul>
        </li>
        <li>
          Data security at rest (order: 1)
          <ul>
            <li>✓ The message database links to the identity service only by uuid</li>
            <li>The message database links to the identity service only by token (order: 4)</li>
            <li>The user's email is stored tokenised and hashed (order: 3)</li>
            <li>Meta data is stripped  (order: 5)</li>
            <li>✓ Separate identity storage</li>
            <li>✓ Internally split API routing</li>
            <li>Tighter access controls on the idenitity database (order: 2)</li>
          </ul>
        </li>
        <li>Strong multi-factor authentication (optional)
          <ul>
            <li>Generate encrypted 160-bit base32 encoded secret</li>
            <li>Store it encrpyted at rest</li>
            <li>Display the secret as a QR code to client</li>
            <li>Client scans QR code into FreeOTP</li>
            <li>Server generates 6-digit code every 30 seconds</li>
            <li>On client log in, generate a code on server to match</li>
            <li>Log client in</li>
          </ul>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.date {
  font-size: small;
}
.message {
  box-sizing: border-box;
  margin: 4rem 0;
}
</style>