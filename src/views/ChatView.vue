<script setup>
import axios from 'axios';
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { encryptMessageForSend } from '../utils/flows';
import { bufferToBase64 } from '../utils/helpers';
import { decryptUserMessage } from '../utils/messageCrypto';
import { prepareUserKeyBundle } from '../utils/flows'
import { base64ToUint8Array } from '../utils/helpers';
import { decryptPrivateKeyForSigning, decryptPrivateKeyForMessage } from '../utils/keyManager';
import { useStateStore } from '../store';
import Icon from '../components/Icon.vue';
import { useRouter } from 'vue-router';
import GridBlock from '../components/GridBlock.vue';
import LandingGrid from '../components/LandingGrid.vue';
import Message from '../components/Message.vue';

const abortController = new AbortController()
const streamReply = ref({})
const router = useRouter()
const store = useStateStore()
const message = defineModel('message')
const isLoading = ref(false)
const isResponding = ref(false)
const promptRef = ref()
const isPromptFloat = ref(false)
const suggestions = [
    {
        short: 'About this chatbot',
        long: 'Explain the differences between this chatbot demo and other chatbot services, and describe the technical specifications'
    },
    {
        short: 'Write a scary story',
        long: 'Draft an outline of a frightening story about an AI chatbot that lacks strong privacy measures'
    }
]

const conversation = computed({
    get() {
        return [...store.messages].sort((a, b) => {
            return new Date(b.datetime) - new Date(a.datetime)
        })
    }
})

const isLanding = computed({
    get() {
        return !conversation.value.length && !isResponding.value
    }
})

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

const writeLocalStorage = async () => {
    const sessionId = store.uuidv4()
    let { publicKey, encryptedPrivateKey, salt, iv } = await prepareUserKeyBundle(sessionId)
    localStorage.setItem("sessionId", sessionId);
    localStorage.setItem('publicKey', publicKey)
    localStorage.setItem('encryptedPrivateKey', encryptedPrivateKey)
    localStorage.setItem('salt', salt)
    localStorage.setItem('iv', iv)
}

const readLocalStorage = async () => {
    const sessionId = localStorage.getItem("sessionId")
    const encryptedPrivateKey = localStorage.getItem('encryptedPrivateKey')
    const salt = base64ToUint8Array(localStorage.getItem('salt'))
    const iv = base64ToUint8Array(localStorage.getItem('iv'))
    store.publicKeyB64 = localStorage.getItem('publicKey')
    store.decryptedPrivateKeyForSigning = await decryptPrivateKeyForSigning(
        encryptedPrivateKey,
        sessionId,
        salt,
        iv
    )
    store.decryptedPrivateKeyForMessaging = await decryptPrivateKeyForMessage(
        encryptedPrivateKey,
        sessionId,
        salt,
        iv
    )
}

const handleSend = async () => {
  isResponding.value = true
  if (!store.isLoggedIn) {
    if (!localStorage.getItem("sessionId")) await writeLocalStorage()
    await readLocalStorage()
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
    anon_session: !store.isLoggedIn,
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
  fetch(store.baseURL + '/message/create-stream',
   {
    method: 'POST',
    body: JSON.stringify(params),
    headers: {
        'Content-Type': 'application/json'
    },
    credentials: 'include',
    signal: abortController.signal
   })
    .then(async response => {
        isResponding.value = false
        
        const time = new Date().getTime()
        store.messages.push({
            sender: 'You',
            body: message.value,
            datetime: new Date(time-1000).toUTCString()
        })
        message.value = ''
        window.scrollTo(0 , 0)

        const reader = response.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''

        streamReply.value = {
            sender: 'Server',
            body: '',
            datetime: new Date(time).toUTCString()
        }

        store.messages.push(streamReply.value)

        while (true) {
            const { value, done } = await reader.read()
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            
            const lines = buffer.split('\n')
            buffer = lines.pop()

            for (const line of lines) {
                if (!line.trim()) continue

                try {
                    const payload = JSON.parse(line)
                    const decrypted = await decryptUserMessage(
                        payload.encrypted_body,
                        payload.wrapped_key_client,
                        payload.iv,
                        store.decryptedPrivateKeyForMessaging
                    )
                    streamReply.value.body += decrypted
                    localStorage.setItem('messages', JSON.stringify(conversation.value))
                } catch (err) {
                    console.log('Error streaming chunk', err)
                }
            }
        }
        streamReply.value = null
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
    window.addEventListener('scroll', handleScroll)
    const wasLoggedIn = localStorage.getItem("isLoggedIn") == 'true'
    if (!wasLoggedIn) {
        const storedMessages = localStorage.getItem('messages')
        if (storedMessages) store.messages = JSON.parse(storedMessages)
    } else if (wasLoggedIn && !store.isLoggedIn) {
        router.push({ name: 'autosignin'})
    }
    setTimeout(() => {
        if (promptRef.value) {
            promptRef.value.focus()
        }
    }, 500)
    if (!store.isLoggedIn) return
    isLoading.value = true
    axios.get(store.baseURL + '/message/list', { withCredentials: true })
        .then(async response => {
            
            store.clearMessages()
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
    abortController.abort()
})

</script>

<template>
    <main v-if="isLoading" class="loading">
        <Icon :size=64 name="spinner"/>
    </main>
    <main v-else :class="isLanding ? 'landing' : ''">
        <div class="prompt" :class="!isLanding ? isPromptFloat ? 'fixed' : 'absolute' : ''">
            <div class="wrapper">
                <textarea v-model="message" rows=2 ref="promptRef" :disabled="isResponding" placeholder="Enter a prompt"/>
                <button @click="handleSend" :disabled="isResponding">Send</button>
            </div>
            <div v-if="isLanding" class="wrapper suggestions">
                <span v-for="suggestion in suggestions" @click="handleSuggestion(suggestion.long)">{{ suggestion.short }}</span>
            </div>
        </div>
        <Message class="loading" v-if="isResponding" />
        <Message v-for="message in conversation" :data="message" />
        <LandingGrid class="blocks" v-if="isLanding">
            <GridBlock>
                <Icon name="code"/>
                <p>Experimental prototype</p>
                <a target="_blank" href="https://github.com/fpstidston/sais-frontend">View code</a>
            </GridBlock>
            <GridBlock>
                <Icon name="lock"/>
                <p>Strong encrpytion</p>
                <router-link :to="{ name: 'about', hash: '#encryption' }">About securtiy</router-link>
            </GridBlock>
            <GridBlock>
                <Icon name="shredder"/>
                <p>Confidential business</p>
                <router-link :to="{ name: 'about', hash: '#policy' }">Why private</router-link>
            </GridBlock>
        </LandingGrid>
        <p class="delete" @click="store.clearAll" v-if="!store.isLoggedIn && store.messages.length">
            <Icon name="shredder" :size=19 />Click here to delete this conversation from local storage
        </p>
    </main>
</template>

<style scoped>
main {
    margin-top: 0;
    padding-top: 100px;
    position: relative;
}
main.loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 50vh
}

main.landing {
    padding-top: 3rem;
}
.suggestions span {
    text-align: left;
    padding: 0 1rem;
    display: inline-block;
    background-color: var(--light-grey);
}
.prompt {
    background-color: white;
}
main:not(.landing) .prompt {
    margin: 0 2rem;;
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
    border: 1px solid var(--border-tint-dark)
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
    background-color: var(--border-tint);
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
@media (min-width: 704px) {
    .suggestions {
        display: flex !important;
    }
}
</style>