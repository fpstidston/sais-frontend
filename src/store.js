import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useStateStore = defineStore('state', () => {
  const isLoggedIn = ref(false)
  let publicKeyB64
  let decryptedPrivateKeyForSigning
  let decryptedPrivateKeyForMessaging
  const messages = ref([])
  const responses = ref([])
  const baseURL = 'http://localhost:5000' //'https://185.44.253.109/sais/api'
  const uuidv4 = () => {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
      (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
    );
  }
  const clearAll = () => {
    messages.value = []
    responses.value = []
    localStorage.removeItem('messages')
    localStorage.removeItem("sessionId");
    localStorage.removeItem('publicKey')
    localStorage.removeItem('encryptedPrivateKey')
    localStorage.removeItem('salt')
    localStorage.removeItem('iv')
  } 
  const clearMessages = () => {
    messages.value = []
    responses.value = []
    localStorage.removeItem('messages')
  }
  return {
    isLoggedIn,
    publicKeyB64,
    decryptedPrivateKeyForSigning,
    decryptedPrivateKeyForMessaging,
    messages,
    responses,
    baseURL,
    uuidv4,
    clearAll,
    clearMessages
  }
})