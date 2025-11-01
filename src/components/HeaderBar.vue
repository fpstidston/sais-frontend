<script setup>
import { RouterLink, useRouter } from 'vue-router';
import { useStateStore } from '../store';
import Icon from './Icon.vue';

const store = useStateStore()
const router = useRouter()

const handleLogout = () => {
    store.isLoggedIn = false
    localStorage.setItem('isLoggedIn', 'false')
    localStorage.removeItem("loggedInUsername")
    localStorage.removeItem("loggedInPassword")
    router.push({ name: 'chat' })
    store.clearAll()
}

</script>

<template>
    <header>
        <div class="wrapper">
            <router-link :to="{ name: 'chat' }">
                <h1><Icon name="chat" :size="21" />Private chatbot</h1>
            </router-link>
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
    color: white;
    background: var(--accent-colour);
    text-align: center;
    padding: 10px 2rem;
}
.wrapper {
    display: flex;
    align-items: center;
}
h1 {
    display: flex;
    align-items: center;
    margin: 0;
    font-size: 16px;
    cursor: pointer;
}
i {
    margin-right: 10px;
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
    padding: 5px 20px;
}
.items :last-child {
    margin-right: -20px;
}
</style>