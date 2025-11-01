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
const username = defineModel('username', { required: true, default: '' })
const password = defineModel('password', { required: true, default: '' })
const formBusy = ref(false)
const hasEnteredUsername = ref(false)
let encryptedPrivateKeyB64
let salt
let iv
let challenge

const handleLogin = () => {
  if (!hasEnteredUsername.value) {
    handleLoginStart()
  } else {
    handleLoginFinish()
  }
}

const handleLoginStart = () => {
  formBusy.value = true
  axios.post(store.baseURL + '/key/get-public', {
    username: username.value,
  }, { withCredentials: true })
    .then(response => {
      hasEnteredUsername.value = true
      store.publicKeyB64 = response.data.public_key
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
  let signature
  try {
    signature = await signChallengeForLogin(
      challenge,
      encryptedPrivateKeyB64,
      password.value,
      salt,
      iv
    )
  } catch (err) {
    console.log("Error signing challenge", err)
    formBusy.value = false
    return
  }
  axios.post(store.baseURL + '/user/verify-login', {
    username: username.value,
    signature: bufferToBase64(signature),
    challenge: challenge
  }, { withCredentials: true })
    .then(async response => {
      if (response.data.logged_in == true) {
        store.isLoggedIn = true
        store.clearMessages()
        localStorage.setItem('isLoggedIn', 'true')
        localStorage.setItem("loggedInUsername", username.value)
        localStorage.setItem("loggedInPassword", password.value)
        store.decryptedPrivateKeyForSigning = await decryptPrivateKeyForSigning(
          encryptedPrivateKeyB64,
          password.value,
          salt,
          iv
        )
        store.decryptedPrivateKeyForMessaging = await decryptPrivateKeyForMessage(
          encryptedPrivateKeyB64,
          password.value,
          salt,
          iv
        )
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
    <h2>{{ !hasEnteredUsername ? 'Sign in' : 'Password'}}</h2>
    <div class="wait" v-if="formBusy">
      <Icon name="spinner" :size=16 />Please wait...
    </div>
    <template v-else>
      <p v-if="!hasEnteredUsername">Access your past conversations</p>
      <input type="text" v-if="!hasEnteredUsername" v-model="text" placeholder="Username"/>
      <input type="password" v-else v-model="password" placeholder="Password"/>
      <button @click="handleLogin">Continue</button>
      <p class="note">Signing in will clear locally-stored anonymous chat</p>
      <p><router-link :to="{ name: 'signup'}"><strong>Create an account</strong></router-link></p>
    </template>
  </main>
</template>

<style scoped>
main {
  display: flex;
  flex-direction: column;
  max-width: 300px;
  gap: 20px
}
.note {
  font-size: 13px;
}
</style>