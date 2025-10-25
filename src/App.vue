<script setup>
import axios from 'axios';
import { ref, computed } from 'vue';
import { prepareUserKeyBundle, encryptMessageForSend } from './utils/flows';
import { importPublicKey, decryptPrivateKeyForMessage, decryptPrivateKeyForSigning } from './utils/keyManager';
import { base64ToUint8Array, bufferToBase64 } from './utils/helpers';
import { decryptUserMessage } from './utils/messageCrypto';
import { signChallengeForLogin } from './utils/signature'
import { marked } from 'marked'

const baseURL = 'http://localhost:5000'
const email = defineModel('email', { required: true, default: 'fpstidston@proton.me' })
const password = defineModel('password', { required: true, default: 'test' })
const message = defineModel('message', { required: true })
const formBusy = ref(false)
const isLoggedIn = ref(false)
const isLoading = ref(false)
const hasEnteredEmail = ref(false)
const messages = ref([])
const responses = ref([])
let publicKeyB64
let serverPublicKeyB64
let encryptedPrivateKeyB64
let decryptedPrivateKeyForSigning
let decryptedPrivateKeyForMessaging
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
  const signature = await signChallengeForLogin(challenge, encryptedPrivateKeyB64, password.value, salt, iv)
  axios.post(baseURL + '/user/verify-login', {
    username: email.value,
    signature: bufferToBase64(signature),
    challenge
  }, { withCredentials: true })
    .then(async response => {
      if (response.data.logged_in == true) {
        isLoggedIn.value = true
        serverPublicKeyB64 = response.data.server_public_key
        decryptedPrivateKeyForSigning = await decryptPrivateKeyForSigning(encryptedPrivateKeyB64, password.value, salt, iv)
        decryptedPrivateKeyForMessaging = await decryptPrivateKeyForMessage(encryptedPrivateKeyB64, password.value, salt, iv)
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
  isLoading.value = true
  const {
    encryptedMessage,
    warppedKeyClient,
    wrappedKeyServer,
    challengeString,
    signature,
    salt,
    iv_wrap
  } = await encryptMessageForSend(message.value, decryptedPrivateKeyForSigning, publicKeyB64)
  axios.post(baseURL + '/message/create', {
    wrapped_key_server: bufferToBase64(wrappedKeyServer),
    wrapped_key_client: bufferToBase64(warppedKeyClient),
    encrypted_message: bufferToBase64(encryptedMessage.ciphertext),
    salt: bufferToBase64(salt),
    iv: bufferToBase64(encryptedMessage.iv),
    iv_wrap: bufferToBase64(iv_wrap),
    signature,
    challenge_string: challengeString
  }, { withCredentials: true })
    .then(async response => {
      messages.value.push({
        sender: 'You',
        body: message.value,
        datetime: new Date().toUTCString()
      })
      message.value = ''
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
      isLoading.value = false
    })
}

const decryptMessages = async (messages) => {
  for(const message of messages) {
    message.body = await decryptUserMessage(
      message.encrypted_body,
      message.wrapped_key_client,
      message.iv,
      decryptedPrivateKeyForMessaging
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
        <h2>{{ !hasEnteredEmail ? 'Log in' : 'Password'}}</h2>
        <input type="email" v-if="!hasEnteredEmail" v-model="email" />
        <input type="password" v-if="hasEnteredEmail" v-model="password"/>
        <button @click="handleLogin">Log in</button>
      </form>
      <template v-else>
        <h2>Gemma3-4B on Ollama</h2>
        <form id="prompt">
          <div class="prompt-container">
            <textarea v-model="message" :disabled="isLoading"/>
            <button @click="handleSend" :disabled="isLoading">Send</button>
          </div>
        </form>
        <div class="message loading" v-if="isLoading">Loading...</div>
        <div class="message" v-for="message in conversation">
          <span class="date">{{ message.datetime }}</span>
          <div class="sender"><strong>{{  message.sender }}</strong></div>
          <div class="body" v-html="marked.parse(message.body)" />
        </div>
      </template>
      <div class="about">
        <h2>Security steps</h2>
        <h3>Messaging</h3>
        <h4>1. Encrpytion</h4>
        <p>User writes and locks a message using a unique message key</p>
        <h4>2. Challenge</h4>
        <p>Client generates a secret for the server</p>
        <h4>3. Signature</h4>
        <p>Client includes proof the secret came from them</p>
        <h4>4. Wrapping</h4>
        <p>Client creates two copies of the message key and locks them,</p>
        <ul>
          <li>One using its own key, for the user to download messages and unlock later</li>
          <li>One using a temporary key, that the server will have to recut for itself</li>
        </ul>
        <p>Temporary key contains a random number and the secret that's proven to be from the client</p>
        <h4>5. Verification</h4>
        <p>Server can check the proof that the secret is from the client</p>
        <h4>6. Derivation</h4>
        <p>Server cuts a temporary key using instructions in the secret that's proven to be from the client</p>
        <h4>7. Unwrapping</h4>
        <p>Server uses temporary key to unlock the message key</p>
        <h4>8. Decryption</h4>
        <p>Server decrpyts the user's message and generates a reply</p>
        <h4>9. Encryption</h4>
        <p>Server locks the reply using a unique message key</p>
        <h4>10. Wrapping</h4>
        <p>Server locks the message key so only the client can unlock it. Server no longer has a way to open the message.</p>
        <h4>11. Storage</h4>
        <p>Server stores the locked messages and the locked keys that only the client can unlock.</p>
        <h4>12. (Incomplete) Challenge</h4>
        <p>Server generates a challenge for the client including the original secret</p>
        <h4>13. (Incomplete) Signature </h4>
        <p>Server includes proof the secret came from them and sends it</p>
        <h4>14. (Incomplete) Verification</h4>
        <p>Client checks for the original secret and the proof it came from the server</p>
        <h3>Recall</h3>
        <h4>Client</h4>
        <p>1. Client requests their locked messages, each with its own locked key that only the client can unlock</p>
        <p>2. Client unlocks their message keys and uses these to unlock each message</p>
        <h4>Server</h4>
        <p>1. (Incomplete) Client relocks their downloaded messages using a message key</p>
        <p>2. (Incomplete) Client creates a new temporary key, challenge (secret) and singature (proof) as before</p>
        <p>3. (Incomplete) Client locks the message key using the temporary key</p>
        <p>4. (Incomplete) Server verifies, derives, unwraps, decrpyts and uses as before, with no retention</p>
        <h3>At rest</h3>
        <ul>
          <li>The message database links to the identity service only by uuid</li>
          <li>(Incomplete) The message database links to the identity service only by token (order: 4)</li>
          <li>(Incomplete) The user's email is stored tokenised and hashed (order: 3)</li>
          <li>(Incomplete) Meta data is stripped  (order: 5)</li>
          <li>Separate identity storage</li>
          <li>Internally split API routing</li>
          <li>(Incomplete) Tighter access controls on the idenitity database (order: 2)</li>
        </ul>
        <h3>Account management</h3>
        <h4>Sign up and log in</h4>
        <p>Server has zero-knowledge of user password</p>
        <ul>
            <li>✓ User generates public/private key pair</li>
            <li>✓ User password is used to genereate a strong key</li>
            <li>✓ Strong key is used to encrypt the private key</li>
            <li>✓ Server receives and stores public key, and encrypted private key</li>
            <li>✓ User signs a challenge using their private key</li>
            <li>✓ Server uses users public_key to verify the signature</li>
        </ul>
        <h4>Multi-factor login</h4>
        <ul>
          <li>Generate encrypted 160-bit base32 encoded secret</li>
          <li>Store it encrpyted at rest</li>
          <li>Display the secret as a QR code to client</li>
          <li>Client scans QR code into FreeOTP</li>
          <li>Server generates 6-digit code every 30 seconds</li>
          <li>On client log in, generate a code on server to match</li>
          <li>Log client in</li>
        </ul>
      </div>
    </template>
  </div>
</template>

<style scoped>
h3 {
  margin-top: 3rem;
}
h4 {
  margin-bottom: 0;
}
.about p {
  margin: 0;
}
.date {
  font-size: small;
}
.message {
  box-sizing: border-box;
  margin: 4rem 0;
}
.message .body {
  padding-left: 1rem;
  border-left: 2px solid silver
}
#prompt {
  display: flex;
  flex-direction: column;
}
.prompt-container {
  display: grid;
  grid-template-columns: 5fr 1fr;
  gap: 10px
}

.prompt-container :disabled {
  opacity: 0.5;
}
</style>