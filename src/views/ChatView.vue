<script setup>
import axios from 'axios';
import { ref, onMounted, onUnmounted } from 'vue';
import { encryptMessageForSend } from '../utils/flows';
import { bufferToBase64 } from '../utils/helpers';
import { decryptUserMessage } from '../utils/messageCrypto';
import { prepareUserKeyBundle } from '../utils/flows'
import { base64ToUint8Array } from '../utils/helpers';
import { signChallengeForLogin } from '../utils/signature';
import { decryptPrivateKeyForSigning, decryptPrivateKeyForMessage } from '../utils/keyManager';
import { useStateStore } from '../store';
import { marked } from 'marked';
import Icon from '../components/Icon.vue';

const store = useStateStore()
const message = defineModel('message', { required: true })
const isLoading = ref(false)
const isResponding = ref(false)
const promptRef = ref()
const isPromptFloat = ref(false)
const suggestions = [
    {
        short: 'About this chatbot',
        long: 'Explain the differences between this chatbot service and other chatbot services, and describe the technical specifications'
    },
    {
        short: 'Write a scary story',
        long: 'Draft an outline of a frightening story about an AI chatbot that lacks strong privacy measures'
    }
]

const getConversation = () => {
    return [...store.messages, ...store.responses].sort((a, b) => a.datetime - b.datetime ? 1 : - 1)
}

const handleSuggestion = (prompt) => {
    message.value = prompt
    handleSend()
}

const handleScroll = () => {
    if (window.scrollY >= 44) {
        isPromptFloat.value = true
    } else {
        isPromptFloat.value = false
    }
}

const initAnon = async () => {
    const sessionId = store.uuidv4()
    let { publicKey, encryptedPrivateKey, salt, iv } = await prepareUserKeyBundle(sessionId)
    localStorage.setItem("sessionId", sessionId);
    localStorage.setItem('publicKey', publicKey)
    localStorage.setItem('encryptedPrivateKey', encryptedPrivateKey)
    localStorage.setItem('salt', salt)
    localStorage.setItem('iv', iv)
    const encryptedPrivateKeyB64 = localStorage.getItem('encryptedPrivateKey')
    salt = base64ToUint8Array(salt)
    iv = base64ToUint8Array(iv)
    store.publicKeyB64 = publicKey
    store.decryptedPrivateKeyForSigning = await decryptPrivateKeyForSigning(
        encryptedPrivateKey,
        sessionId,
        salt,
        iv
    )
    store.decryptedPrivateKeyForMessaging = await decryptPrivateKeyForMessage(
        encryptedPrivateKeyB64,
        sessionId,
        salt,
        iv
    )
}

const handleSend = async () => {
  isResponding.value = true
  if (!store.isLoggedIn) {
    const sessionId = localStorage.getItem("sessionId");
    if (!sessionId) await initAnon()
  }
  const {
    encryptedMessage,
    wrappedKeyClient,
    wrappedKeyServer,
    challengeString,
    signature,
    salt,
    iv_wrap
  } = await encryptMessageForSend(message.value, store.decryptedPrivateKeyForSigning, store.publicKeyB64)
  let params = {
    client_public_key: store.publicKeyB64,
    wrapped_key_server: bufferToBase64(wrappedKeyServer),
    wrapped_key_client: bufferToBase64(wrappedKeyClient),
    encrypted_message: bufferToBase64(encryptedMessage.ciphertext),
    salt: bufferToBase64(salt),
    iv: bufferToBase64(encryptedMessage.iv),
    iv_wrap: bufferToBase64(iv_wrap),
    signature,
    challenge_string: challengeString
  }
  if (!store.isLoggedIn) {
    params.anon_session = true
  }
  axios.post(store.baseURL + '/message/create', params, { withCredentials: true })
    .then(async response => {
      store.messages.push({
        sender: 'You',
        body: message.value,
        datetime: new Date().toUTCString()
      })
      message.value = ''
      const encrpytedReply = response.data.response
      const replies = await decryptMessages([encrpytedReply])
      const reply = replies[0]
      store.responses.push({
        sender: 'Server',
        body: reply.body,
        datetime: new Date().toUTCString()
      })
      localStorage.setItem('messages', JSON.stringify(getConversation()))
      window.scrollTo(0 , 0)
    })
    .catch(err => {
      console.log('Error sending message', err)
    })
    .finally(() => {
      isResponding.value = false
    })
}

const decryptMessages = async (messages) => {
  for(const message of messages) {
    message.body = await decryptUserMessage(
      message.encrypted_body,
      message.wrapped_key_client,
      message.iv,
      store.decryptedPrivateKeyForMessaging
    )
  }
  return messages
}

onMounted(async () => {
    store.isLoggedIn = localStorage.getItem("isLoggedIn") == 'true'
    if (!store.isLoggedIn) {
        const storedMessages = localStorage.getItem('messages')
        if (storedMessages) store.messages = JSON.parse(storedMessages)
    } else {
        isLoading.value = true
        let encryptedPrivateKeyB64
        let salt
        let iv
        let challenge
        const username = localStorage.getItem("loggedInUsername")
        const password = localStorage.getItem("loggedInPassword")
        try {
            const response = await axios.post(store.baseURL + '/key/get-public', {
                    username
                }, { withCredentials: true })
            store.publicKeyB64 = response.data.public_key
            encryptedPrivateKeyB64 = response.data.encrypted_private_key
            salt = base64ToUint8Array(response.data.salt)
            iv = base64ToUint8Array(response.data.iv)
            challenge = response.data.challenge
        } catch (err) {
            console.log("Error getting user", err)
            isLoading.value = false
            return
        }
        let signature
        try {
            signature = await signChallengeForLogin(
                challenge,
                encryptedPrivateKeyB64,
                password,
                salt,
                iv
            )
        } catch (err) {
            console.log("Error signing challenge", err)
            isLoading.value = false
            return
        }
        try {
            const response = await axios.post(store.baseURL + '/user/verify-login', {
                    username,
                    signature: bufferToBase64(signature),
                    challenge: challenge
                }, { withCredentials: true })
            if (response.data.logged_in == true) {
                store.isLoggedIn = true
                localStorage.setItem('isLoggedIn', 'true')
                store.decryptedPrivateKeyForSigning = await decryptPrivateKeyForSigning(
                    encryptedPrivateKeyB64,
                    password,
                    salt,
                    iv
                )
                store.decryptedPrivateKeyForMessaging = await decryptPrivateKeyForMessage(
                    encryptedPrivateKeyB64,
                    password,
                    salt,
                    iv
                )
            } else {
                console.log('Error logging in')
            }
        } catch (err) {
            console.log("Error verifying sign-in", err)
            isLoading.value = false
            return
        }
    }
    window.addEventListener('scroll', handleScroll)
    setTimeout(() => {
        promptRef.value.focus()
    }, 200)
    if (!store.isLoggedIn) return
    isLoading.value = true
    axios.get(store.baseURL + '/message/list', { withCredentials: true })
        .then(async response => {
            store.messages = await decryptMessages(response.data.messages)
            window.scrollTo(0, 0)
        })
        .catch(err => {
            console.log('Error loading messages', err)
        })
        .finally(() => {
            isLoading.value = false
        })
})

onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll)
})

</script>

<template>
    <main v-if="isLoading" class="loading">
        <Icon size="64" name="spinner"/>
    </main>
    <main v-else :class="!getConversation().length ? 'landing' : ''">
        <div class="prompt" :class="getConversation().length ? isPromptFloat ? 'fixed' : 'absolute' : ''">
            <div class="wrapper">
                <textarea v-model="message" rows=2 ref="promptRef" :disabled="isResponding" placeholder="Enter a prompt"/>
                <button @click="handleSend" :disabled="isResponding">Send</button>
            </div>
            <div v-if="!isResponding && !getConversation().length" class="wrapper suggestions">
                <span v-for="suggestion in suggestions" @click="handleSuggestion(suggestion.long)">{{ suggestion.short }}</span>
            </div>
        </div>
        <div class="message loading" v-if="isResponding"><Icon name="spinner" size=16 />Please wait...</div>
        <div class="message" v-for="message in getConversation()" :class="message.sender == 'You' ? 'user' : 'bot'">
            <span class="date">{{ message.datetime }}</span>
            <div class="sender"><strong>{{  message.sender }}</strong></div>
            <div class="body" v-html="marked.parse(message.body)" />
        </div>
        <div class="blocks" v-if="!isResponding && !getConversation().length">
            <div>
                <Icon name="code"/>
                <p>Experimental prototype</p>
                <a target="_blank" href="https://github.com/fpstidston">View code</a>
            </div>
            <div>
                <Icon name="lock"/>
                <p>Strong encrpytion</p>
                <router-link :to="{ name: 'about', hash: '#encryption' }">About securtiy</router-link>
            </div>
            <div>
                <Icon name="shredder"/>
                <p>Confidential business</p>
                <router-link :to="{ name: 'about', hash: '#policy' }">Why private</router-link>
            </div>
        </div>
        <p class="delete" @click="store.clearAll" v-if="!store.isLoggedIn && store.messages.length">
            <Icon name="shredder" size=19 />Click here to delete this conversation from local storage
        </p>
    </main>
</template>

<style scoped>
.blocks {
    display: grid;
    gap: 30px;
    margin-bottom: 2rem;
    margin-top: 60px;
}
.blocks > div {
    border: 1px solid #0002;
    padding: 30px;
    font-size: 18px;
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}
.blocks p {
    margin: 0;
}
.blocks a,
.blocks span {
    font-size: 14px;
}
.date {
  font-size: small;
  display: none;
}
main.loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 50vh
}
main {
    margin-top: 0;
    position: relative;
}
main.landing {
    padding-top: 3rem;
}
main:not(.landing) {
    padding-top: calc(100px);
}
.chat {
    text-decoration: underline;
}
.message.user {
    text-align: right;
}
.message {
  box-sizing: border-box;
  margin: 1rem 0;
}
.message .body,
.suggestions span {
    text-align: left;
    padding: 0 1rem;
    display: inline-block;
}
.message.user .body,
.suggestions span {
    background-color: #eee;
}
.message.bot .body {
    background-color: white;
    border: 1px solid #0002;
}
.message.loading {
    display: flex;
    align-items: center;
}
.message i {
    margin-right: 10px;
}
.prompt {
    background-color: white;
}
main:not(.landing) .prompt {
    margin: 0 2rem;;
}
.delete {
    display: inline-flex;
    align-items: center;
    text-decoration: underline;
    font-size: 13px;
    color: gray;
    cursor: pointer;
}
.delete i {
    margin-right: 5px;
    opacity: 0.5;
}
.landing .delete {
    display: none
}
.prompt .wrapper {
  display: flex;
  gap: 10px;
  align-items: end;
}
.prompt textarea {
    flex-grow: 1;
}
.prompt :disabled {
  opacity: 0.5;
}
.prompt.absolute .wrapper,
.prompt.fixed  .wrapper {
    border-bottom: 1px solid #0003;
    padding: 1rem 0;
}
.prompt.absolute {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
}
.prompt.fixed {
    position: fixed;
    top: 0;
    left: 0;
    right: 0
}
.prompt textarea {
    resize: none;
    border: 1px solid #0008
}
.suggestions {
    display: none !important;
    flex-wrap: wrap;
    justify-content: center;
    margin: 1rem 0;
}
.suggestions span {
    display: inline-block;
    padding: 0.5rem 1rem;
    cursor: pointer;
}
.suggestions span:hover {
    background-color: #0002;
}
@media (min-width: 704px) {
    .suggestions {
        display: flex !important;
    }
    .blocks {
        grid-template-columns: repeat(3, 1fr);
    }
}
</style>