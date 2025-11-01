<template>
    <div>
        <slot></slot>
    </div>
</template>

<style scoped>
.blocks {
    display: grid;
    gap: 30px;
    margin-bottom: 2rem;
    margin-top: 60px;
}
@media (min-width: 704px) {
    .blocks {
        grid-template-columns: repeat(3, 1fr);
    }
}
</style>