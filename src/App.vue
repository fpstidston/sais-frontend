<script setup>
import { useRoute } from 'vue-router';
import HeaderBar from './components/HeaderBar.vue'
const route = useRoute()
</script>

<template>
  <HeaderBar />
  <router-view :key="route.fullPath"></router-view>
</template>