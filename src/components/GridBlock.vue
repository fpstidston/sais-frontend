<template>
    <div>
        <slot></slot>
    </div>
</template>
<style scoped>
div {
    border: 1px solid var(--border-tint);
    padding: 30px;
    font-size: 18px;
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}
p {
    margin: 0;
}
a,
span {
    font-size: 14px;
}
</style>