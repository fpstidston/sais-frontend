<script setup>
    import axios from 'axios'
    import { RouterLink, useRouter } from 'vue-router';
    import { ref } from 'vue'
    import { prepareUserKeyBundle } from '../utils/flows';
    import { useStateStore } from '../store';

    const router = useRouter()
    const store = useStateStore()
    const email = defineModel('email', { required: true, default: '' })
    const password = defineModel('password', { required: true, default: '' })
    const formBusy = ref(false)

    const handleSignup = async () => {
        if (!email.value) return
        if (!password.value) return
        formBusy.value = true
        const { publicKey, encryptedPrivateKey, salt, iv } = await prepareUserKeyBundle(password.value)
        axios.post(store.baseURL + '/user/create', {
            username: email.value,
            public_key: publicKey,
            encrypted_private_key: encryptedPrivateKey,
            salt,
            iv
        }, { withCredentials: true })
            .then(() => {
                router.push({ name: 'signin' })
            })
            .catch(err => {
                console.log('Error creating account', err)
            }) 
            .finally(() => {
                formBusy.value = false
            })
    }
</script>

<template>
    <main>
        <form>
            <h2>Create account</h2>
            <div v-if="formBusy">
                Please wait...
            </div>
            <template v-else>
                <input type="email" v-model="email" placeholder="Username"/>
                <input type="password" v-model="password"  placeholder="Password"/>
                <button @click="handleSignup">Create account</button>
                <p><router-link :to="{ name: 'signin' }"><strong>Sign in to an account</strong></router-link></p>
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