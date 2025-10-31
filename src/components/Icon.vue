<script setup>
defineProps({
    name: String,
    size: {
        type: Number,
        default: 32
    }
})
</script>

<template>
    <i class="icon" :class="name" :style="{ width: `${size}px`,  height: `${size}px`,  backgroundSize: `${size}px` }" />
</template>

<style scoped>
i.icon {
    display: block;
}
i.code {
    background-image: url(../assets/code.svg);
}
i.lock {
    background-image: url(../assets/lock.svg);
}
i.shredder {
    background-image: url(../assets/shredder.svg);
}
i.cloud {
    background-image: url(../assets/cloud.svg);
}
i.chat {
    background-image: url(../assets/chat.svg);
    filter: invert(100%);
}
i.spinner {
    background-image: url(../assets/spinner.svg);
    animation: spin 1s linear infinite;
}
@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}
</style>