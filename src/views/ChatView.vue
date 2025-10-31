<script setup>
import axios from 'axios';
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { encryptMessageForSend } from '../utils/flows';
import { bufferToBase64 } from '../utils/helpers';
import { decryptUserMessage } from '../utils/messageCrypto';
import { useStateStore } from '../store';
import { marked } from 'marked';
import Icon from '../components/Icon.vue';

const store = useStateStore()
const baseURL = 'http://localhost:5000'
// const baseURL = 'https://185.44.253.109/sais/api'
const message = defineModel('message', { required: true })
const isLoading = ref(false)
const promptRef = ref()
const isPromptFloat = ref(false)

const conversation = computed({
  get() {
    return [...store.messages, ...store.responses].sort((a, b) => a.datetime - b.datetime).reverse()
  }
})

const handleScroll = () => {
    if (window.scrollY > 50) {
        isPromptFloat.value = true
    } else {
        isPromptFloat.value = false
    }
}

const handleSend = async () => {
  isLoading.value = true
  const {
    encryptedMessage,
    wrappedKeyClient,
    wrappedKeyServer,
    challengeString,
    signature,
    salt,
    iv_wrap
  } = await encryptMessageForSend(message.value, store.decryptedPrivateKeyForSigning, store.publicKeyB64)
  axios.post(baseURL + '/message/create', {
    wrapped_key_server: bufferToBase64(wrappedKeyServer),
    wrapped_key_client: bufferToBase64(wrappedKeyClient),
    encrypted_message: bufferToBase64(encryptedMessage.ciphertext),
    salt: bufferToBase64(salt),
    iv: bufferToBase64(encryptedMessage.iv),
    iv_wrap: bufferToBase64(iv_wrap),
    signature,
    challenge_string: challengeString
  }, { withCredentials: true })
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
      window.scrollTo(0 , 0)
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
      store.decryptedPrivateKeyForMessaging
    )
  }
  return messages
}

onMounted(() => {
    window.addEventListener('scroll', handleScroll)
    setTimeout(() => {
        promptRef.value.focus()
    }, 200)
    if (!store.isLoggedIn) return
    axios.get(baseURL + '/message/list', { withCredentials: true })
        .then(async response => {
            store.messages = await decryptMessages(response.data.messages)
            window.scrollTo(0, 0)
        })
        .catch(err => {
            console.log('Error loading messages', err)
        })
})

onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll)
})

</script>

<template>
    <main :class="!conversation.length ? 'landing' : ''">
        <section class="blocks" v-if="!conversation.length">
            <div>
                <Icon name="code"/>
                <p>Experimental prototype</p>
                <a target="_blank" href="https://github.com/fpstidston">View the code</a>
            </div>
            <div>
                <Icon name="lock"/>
                <p>Strong encrpytion</p>
                <router-link :to="{ name: 'about' }">About securtiy</router-link>
            </div>
            <div>
                <Icon name="shredder"/>
                <p>Confidentiality policy</p>
                <router-link :to="{ name: 'about' }">About use cases</router-link>
            </div>
        </section>
        <div class="message loading" v-if="isLoading">Please wait...</div>
        <div class="message" v-for="message in conversation" :class="message.sender == 'You' ? 'user' : 'bot'">
            <span class="date">{{ message.datetime }}</span>
            <div class="sender"><strong>{{  message.sender }}</strong></div>
            <div class="body" v-html="marked.parse(message.body)" />
        </div>
        <section  class="prompt" :class="conversation.length ? isPromptFloat ? 'fixed' : 'absolute' : ''">
            <div class="wrapper">
                <textarea v-model="message" rows=1 ref="promptRef" :disabled="isLoading" placeholder="Enter a prompt"/>
                <button @click="handleSend" :disabled="isLoading">Send</button>
            </div>
        </section>
    </main>
</template>

<style scoped>
section.blocks {
    /* padding: 30px; */
    display: grid;
    gap: 30px;
    margin-bottom: 2rem;
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

main {
    margin-top: 0;
    position: relative;
}
main.landing {
    padding-top: 3rem;
}
main:not(.landing) {
    padding-top: calc(3rem + 100px);
}
.message.user {
    text-align: right;
}
.message {
  box-sizing: border-box;
  margin: 3rem 0;
}
.message:first-child {
    margin-top: 0;
}
.message .body {
    padding: 0 1rem;
    display: inline-block;
}
.message.user .body {
    background-color: #eee;
}
.message.bot .body {
    background-color: white;
    border: 1px solid #0002;
}
.prompt {
    background-color: white;
}
main:not(.landing) .prompt {
    margin: 0 2rem;;
}
.prompt .wrapper {
  display: flex;
  gap: 10px;
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
    padding: 30px 0;
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

@media (min-width: 704px) {
    section.blocks {
        grid-template-columns: repeat(3, 1fr);
    }
}
</style>