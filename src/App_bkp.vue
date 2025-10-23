<script setup>
import axios from 'axios';
import { ref } from 'vue';

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

function bufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToUint8Array(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

const handleSignup = async () => {
  if (!email.value) return
  if (!password.value) return

  formBusy.value = true
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256"
    },
    true,
    ["encrypt", "decrypt"]
  )
  const encoder = new TextEncoder()
  const passwordKey = await crypto.subtle.importKey(
    "raw", 
    encoder.encode(password.value),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  )
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    passwordKey,
    {
      name: "AES-GCM",
      length: 256
    },
    true,
    ["encrypt", "decrypt"]
  )
  const publicKeyBuffer = await crypto.subtle.exportKey(
    'spki',
    publicKey
  )
  const privateKeyBuffer = await crypto.subtle.exportKey(
    'pkcs8',
    privateKey
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encryptedPrivateKey = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    derivedKey, 
    privateKeyBuffer
  )
  axios.post(baseURL + '/user/create', {
    username: email.value,
    public_key: bufferToBase64(publicKeyBuffer),
    encrypted_private_key: bufferToBase64(encryptedPrivateKey),
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv)
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
  const encoder = new TextEncoder()
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password.value),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  )
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt, 
      iterations: 100000,
      hash: "SHA-256"
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  )
  const decryptedPrivateKeyBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv
    }, 
    derivedKey, 
    encryptedPrivateKey
  )
  const decryptedPrivateKey = await crypto.subtle.importKey(
    "pkcs8",
    decryptedPrivateKeyBuffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    true,
    ["sign"]
  )
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