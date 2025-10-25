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
const showLogin = ref(false)
const showPrivacy = ref(false)
const showAccount = ref(false)
const showStorage = ref(false)
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

const handleLogout = () => {
  isLoggedIn.value = false
  showLogin.value = false
  hasEnteredEmail.value = false
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
  <main>
    <div v-if="formBusy">
      Please wait...
    </div>
    <template v-else>
      <p v-if="!isLoggedIn">This page aims to demonstrate client-server messaging that exhibits trustless and zero-knowledge communication features</p>
      <form v-if="!isLoggedIn && !showLogin">
        <h2>Create account</h2>
        <input type="email" v-model="email" />
        <input type="password" v-model="password"/>
        <button @click="handleSignup">Create account</button>
        <p><a @click="showLogin = true"><strong>Already have an account? Log in</strong></a></p>
      </form>
      <form v-else-if="!isLoggedIn && showLogin">
        <h2>{{ !hasEnteredEmail ? 'Log in' : 'Password'}}</h2>
        <input type="email" v-if="!hasEnteredEmail" v-model="email" />
        <input type="password" v-if="hasEnteredEmail" v-model="password"/>
        <button @click="handleLogin">Log in</button>
        <p><a @click="showLogin = false"><strong>Don't have an account? Create one</strong></a></p>
      </form>
      <template v-else>
        <h4><a @click="handleLogout">Log out</a></h4>
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
        <h5>Read about privacy measures</h5>
        <h3 @click="showPrivacy = !showPrivacy">Message and response</h3>
        <template v-if="showPrivacy">
          <ol>
            <li>
              <strong>Encryption:</strong> User writes and locks a message using a unique message key
            </li>
            <li>
              <strong>Challenge:</strong> Client generates a secret for the server to prove who they are when they get back
            </li>
            <li>
              <strong>Signature:</strong> Client includes proof the secret came from them
            </li>
            <li>
              <strong>Wrapping:</strong> Client creates two copies of the message key and locks them
              <ul>
                <li>One using its own key, for the user to download messages and unlock later</li>
                <li>One using a temporary key, that the server will have to recut for itself</li>
              </ul>
              Temporary key contains a random number and the secret that's proven to be from the client
            </li>
            <li>
              <strong>Verification:</strong> Server can check the proof that the secret is from the client
            </li>
            <li>
              <strong>Derivation:</strong> Server cuts a temporary key using instructions in the secret that's proven to be from the client
            </li>
            <li>
              <strong>Unwrapping:</strong> Server uses temporary key to unlock the message key
            </li>
            <li>
              <strong>Decryption:</strong> Server decrypts the user's message and generates a reply
            </li>
            <li>
              <strong>Encryption:</strong> Server locks the reply using a unique message key
            </li>
            <li>
              <strong>Wrapping:</strong> Server locks the message key so only the client can unlock it. Server no longer has a way to open the message.
            </li>
            <li>
              <strong>Storage:</strong> Server stores the locked messages and the locked keys that only the client can unlock.
            </li>
            <li>
              <strong>(Incomplete) Challenge:</strong> Server generates a challenge for the client including the original secret
            </li>
            <li>
              <strong>(Incomplete) Signature:</strong> Server includes proof the secret came from them and sends it
            </li>
            <li>
              <strong>(Incomplete) Verification:</strong> Client checks for the original secret and the proof it came from the server
            </li>
          </ol>
        </template>
        <h3 @click="showStorage = !showStorage">Storage and retrieval</h3>
        <template v-if="showStorage">
          <h4>Client-sever</h4>
          <ol>
            <li>Client requests their locked messages, each with its own locked key that only the client can unlock</li>
            <li>Client unlocks their message keys and uses these to unlock each message</li>
          </ol>
          <h4>Server-client</h4>
          <ol>
            <li>(Incomplete) Client relocks their downloaded messages using a message key</li>
            <li>(Incomplete) Client creates a new temporary key, challenge (secret) and singature (proof) as before</li>
            <li>(Incomplete) Client locks the message key using the temporary key</li>
            <li>(Incomplete) Server verifies, derives, unwraps, decrpyts and uses as before, without retaining</li>
          </ol>
          <h4>At rest</h4>
          <ul>
            <li>The message database links to the identity service only by uuid</li>
            <li>(Incomplete) The message database links to the identity service only by token (order: 4)</li>
            <li>(Incomplete) The user's email is stored tokenised and hashed (order: 3)</li>
            <li>(Incomplete) Meta data is stripped  (order: 5)</li>
            <li>Separate identity storage</li>
            <li>Internally split API routing</li>
            <li>(Incomplete) Tighter access controls on the idenitity database (order: 2)</li>
          </ul>
        </template>
        <h3 @click="showAccount = !showAccount">Account</h3>
        <template v-if="showAccount">
        <h4>Sign up and log in</h4>
          <p>Server has zero-knowledge of user password</p>
          <ul>
              <li>User generates public/private key pair</li>
              <li>User password is used to genereate a strong key</li>
              <li>Strong key is used to encrypt the private key</li>
              <li>Server receives and stores public key, and encrypted private key</li>
              <li>User signs a challenge using their private key</li>
              <li>Server uses users public_key to verify the signature</li>
          </ul>
          <h4>(Not started) Multi-factor login</h4>
          <ul>
            <li>Generate encrypted 160-bit base32 encoded secret</li>
            <li>Store it encrpyted at rest</li>
            <li>Display the secret as a QR code to client</li>
            <li>Client scans QR code into FreeOTP</li>
            <li>Server generates 6-digit code every 30 seconds</li>
            <li>On client log in, generate a code on server to match</li>
            <li>Log client in</li>
          </ul>
        </template>
      </div>
    </template>
  </main>
</template>

<style scoped>
form {
  display: flex;
  flex-direction: column;
  max-width: 300px;
  gap: 20px
}
h3:not(:first-of-type) {
  border-top: 1px solid rgb(215, 215, 128);
}
.about h3::before {
  content: "▶ ";
  font-size: 14px;
}
.about h3 {
  cursor: pointer;
}
.about h3 {
  padding: 1rem 0;
  margin: 0;
}
.about h5 {
  margin-bottom: 0;
  font-weight: normal;
}
.about {
  margin-top: 3rem;
  padding: 0 1rem;
  border: 1px solid rgb(215, 215, 128);
  background-color: rgb(255, 255, 228);
}
.about ul, ol {
  padding-left: 1rem;
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