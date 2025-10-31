import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useStateStore = defineStore('state', () => {
  const isLoggedIn = ref(false)
  let publicKeyB64
  let serverPublicKeyB64
  let encryptedPrivateKeyB64
  let decryptedPrivateKeyForSigning
  let decryptedPrivateKeyForMessaging
  let salt
  let challenge
  let iv
  const messages = ref([])
  const responses = ref([])
  return {
    isLoggedIn,
    publicKeyB64,
    serverPublicKeyB64,
    encryptedPrivateKeyB64,
    decryptedPrivateKeyForSigning,
    decryptedPrivateKeyForMessaging,
    salt,
    challenge,
    iv,
    messages,
    responses
  }
})