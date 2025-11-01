<script setup>
import Icon from './Icon.vue';
import { marked } from 'marked';

const props = defineProps(['data'])

</script>

<template>
    <div v-if="!data" class="message"><Icon name="spinner" :size=16 />Please wait...</div>
    <div v-else class="message"  :class="data.sender == 'You' ? 'user' : 'bot'">
        <span class="date">{{ data.datetime }}</span>
        <div class="sender"><strong>{{  data.sender }}</strong></div>
        <div class="body" v-html="marked.parse(data.body)" />
    </div>
</template>

<style scoped>
.message {
    box-sizing: border-box;
    margin: 1rem 0;
}
.message .date {
  /* font-size: small; */
  display: none;
}
.message.user {
    text-align: right;
}
.message .body {
    text-align: left;
    padding: 0 1rem;
    display: inline-block;
}
.message.user .body {
    background-color: #eee;
}
.message.bot .body {
    background-color: white;
    border: 1px solid #0002;
}
.message.loading {
    display: flex;
    align-items: center;
}
.message i {
    margin-right: 10px;
}
</style>