<script setup>
import { RouterLink, useRouter } from 'vue-router';
import { useStateStore } from '../store';

const store = useStateStore()
const router = useRouter()

const handleLogout = () => {
    store.isLoggedIn = false
    store.messages = []
    store.responses = []
    router.push({ name: 'chat' })
}
</script>

<template>
    <header>
        <div class="wrapper">
            <h1><router-link :to="{ name: 'chat' }">Private chatbot</router-link></h1>
            <div class="items">
                <router-link :to="{ name: 'about' }">About</router-link>
                <router-link :to="{ name: 'signin' }" v-if="!store.isLoggedIn">Sign in</router-link>
                <span @click="handleLogout" v-else>Sign out</span>
            </div>
        </div>
    </header>
</template>

<style scoped>
header {
    text-align: center;
    padding: 10px 2rem;
}
.wrapper {
    display: flex;
    align-items: center;
}
h1 {
    margin: 0;
    font-size: 16px;
}
a, span {
    color: inherit;
    font-size: 16px;
    font-weight: bold;
    text-decoration: none;
    cursor: pointer;
}
.items {
    margin-left: auto;
}
.items > * {
    padding: 5px 15px;
}
.items :last-child {
    margin-right: -15px;
}
</style>