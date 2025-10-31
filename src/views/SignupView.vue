<script setup>
    import { RouterLink } from 'vue-router';
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