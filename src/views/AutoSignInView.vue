<script setup>
import axios from 'axios'
import { onMounted, ref } from 'vue'
import Icon from '../components/Icon.vue'
import { useRouter } from 'vue-router'
import { useStateStore } from '../store'
import { base64ToUint8Array, bufferToBase64 } from '../utils/helpers'
import { signChallengeForLogin } from '../utils/signature'
import { decryptPrivateKeyForSigning, decryptPrivateKeyForMessage } from '../utils/keyManager'

const store = useStateStore()
const router = useRouter()

onMounted(async () => {
    let encryptedPrivateKeyB64
    let salt
    let iv
    let challenge
    const username = localStorage.getItem("loggedInUsername")
    const password = localStorage.getItem("loggedInPassword")
    try {
        const response = await axios.post(store.baseURL + '/key/get-public',
            { username },
            { withCredentials: true }
        )
        store.publicKeyB64 = response.data.public_key
        encryptedPrivateKeyB64 = response.data.encrypted_private_key
        salt = base64ToUint8Array(response.data.salt)
        iv = base64ToUint8Array(response.data.iv)
        challenge = response.data.challenge
    } catch (err) {
        console.log("Error getting user", err)
        router.push({ name: 'signin'})
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
        router.push({ name: 'signin'})
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
            router.push({ name: 'chat'})
        } else {
            console.log('Error logging in')
        }
    } catch (err) {
        console.log("Error verifying sign-in", err)
        router.push({ name: 'signin'})
        return
    }
})
</script>

<template>
    <main>
        <Icon :size=64 name="spinner"/>
    </main>
</template>

<style scoped>
main {
    padding-top: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 50vh;
    position: relative;
}
</style>