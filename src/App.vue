<script setup>
import axios from 'axios';
import { ref } from 'vue';
import { prepareUserKeyBundle } from './utils/flows';
import { decryptPrivateKey } from './utils/keyManager';
import { base64ToUint8Array, bufferToBase64 } from './utils/helpers';
const baseURL = 'http://localhost:5000'
const email = defineModel('email', { required: true })
const password = defineModel('password', { required: true })
const formBusy = ref(false)
const isLoggedIn = ref(false)
const hasEnteredEmail = ref(false)
let publicKey
let encryptedPrivateKey
let salt
let challenge
let iv

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
      publicKey = response.data.publicKey
      encryptedPrivateKey = base64ToUint8Array(response.data.encrypted_private_key)
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
  const decryptedPrivateKey = await decryptPrivateKey(encryptedPrivateKey, password.value, salt, iv)
  const challengeEncoder = new TextEncoder()
  const challengeBuffer = challengeEncoder.encode(challenge)
  const signature = await crypto.subtle.sign(
    {
      name: "RSASSA-PKCS1-v1_5"
    },
    decryptedPrivateKey,
    challengeBuffer
  )
  axios.post(baseURL + '/user/verify-login', {
    username: email.value,
    signature: bufferToBase64(signature),
    challenge
  }, { withCredentials: true })
    .then(response => {
      if (response.data.logged_in == true) {
        isLoggedIn.value = true
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


</script>

<template>
  <div>
    <div v-if="formBusy">
      Please wait...
    </div>
    <template v-else>
      <button @click="handleTest">Test</button>
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
      <form v-else>
        <label>Message</label>
        <textarea></textarea>
        <button @click="handleSend">Send</button>
      </form>
      <h2>Security aims</h2>
      <ul>
        <li>Zero-knowledge hyrbid encyption messaging
          <ul>
            <li>✓ User generates public/private key pair</li>
            <li>✓ User password is used to genereate a strong key</li>
            <li>✓ Strong key is used to encrypt the private key</li>
            <li>✓ Server receives and stores public key, and encrypted private key</li>
            <li>User writes and encrypts a message using a new message key</li>
            <li>User message key is encrypted with server's public key</li>
            <li>Server receives encrypted message and encrypted key</li>
            <li>Server decrypts message key using its private key</li>        
            <li>Server genereates a reply and a new message key</li>
            <li>Server encrypts reply with the message key</li>
            <li>Server encrypts the message key with the user's public key</li>
            <li>User decrypts their private key using their password</li>
            <li>User decrypts the message key using their private key</li>
            <li>User decrypts the message using the message key</li>
          </ul>
        </li>
        <li>Anonymised conversations
          <ul>
            <li>The message database links to the identity service only by uuid (or token)</li>
            <li>Meta data is stripped</li>
            <li>Separate identity storage</li>
            <li>Internally split API module routing</li>
            <li>Tighter access controls on the idenitity database</li>
            <li>The user's email or phone is stored tokenised</li>
          </ul>
        </li>
        <li>Strong multi-factor authentication (optional)
          <ul>
            <li>Create user account</li>
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