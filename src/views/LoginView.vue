<script setup>
import axios from 'axios';
import { RouterLink } from 'vue-router';
import { ref } from 'vue';
import { decryptPrivateKeyForMessage, decryptPrivateKeyForSigning } from '../utils/keyManager';
import { base64ToUint8Array, bufferToBase64 } from '../utils/helpers';
import { signChallengeForLogin } from '../utils/signature'
import { useStateStore } from '../store';
import { useRouter } from 'vue-router';

const router = useRouter()
const store = useStateStore()
const email = defineModel('email', { required: true, default: '' })
const password = defineModel('password', { required: true, default: '' })
const formBusy = ref(false)
const hasEnteredEmail = ref(false)

const handleLogin = () => {
  if (!hasEnteredEmail.value) {
    handleLoginStart()
  } else {
    handleLoginFinish()
  }
}

const handleLoginStart = () => {
  formBusy.value = true
  axios.post(store.baseURL + '/key/get-public', {
    username: email.value,
  }, { withCredentials: true })
    .then(response => {
      hasEnteredEmail.value = true
      store.publicKeyB64 = response.data.public_key
      store.encryptedPrivateKeyB64 = response.data.encrypted_private_key
      store.salt = base64ToUint8Array(response.data.salt)
      store.iv = base64ToUint8Array(response.data.iv)
      store.challenge = response.data.challenge
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
  const signature = await signChallengeForLogin(store.challenge, store.encryptedPrivateKeyB64, password.value, store.salt, store.iv)
  axios.post(store.baseURL + '/user/verify-login', {
    username: email.value,
    signature: bufferToBase64(signature),
    challenge: store.challenge
  }, { withCredentials: true })
    .then(async response => {
      if (response.data.logged_in == true) {
        store.isLoggedIn = true
        store.serverPublicKeyB64 = response.data.server_public_key
        store.decryptedPrivateKeyForSigning = await decryptPrivateKeyForSigning(store.encryptedPrivateKeyB64, password.value, store.salt, store.iv)
        store.decryptedPrivateKeyForMessaging = await decryptPrivateKeyForMessage(store.encryptedPrivateKeyB64, password.value, store.salt, store.iv)
        router.push({ name: 'chat' })
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
  <main>
    <form>
      <h2>{{ !hasEnteredEmail ? 'Sign in' : 'Password'}}</h2>
      <div v-if="formBusy">
        Please wait...
      </div>
      <template v-else>
        <input type="email" v-if="!hasEnteredEmail" v-model="email" placeholder="Username"/>
        <input type="password" v-if="hasEnteredEmail" v-model="password" placeholder="Password"/>
        <button @click="handleLogin">Continue</button>
        <p><router-link :to="{ name: 'signup'}"><strong>Create an account</strong></router-link></p>
      </template>
    </form>
  </main>
</template>

<style scoped>
form {
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  max-width: 300px;
  gap: 20px
}
</style>