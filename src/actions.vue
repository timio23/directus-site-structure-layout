<script setup lang="ts">
// import { useRouter } from 'vue-router';
defineOptions({ inheritAttrs: false });
// const router = useRouter();
defineProps<{
	showingCount?: string;
    limit: number;
    itemCount: number;
}>();
</script>
<template>
    <transition name="fade">
		<span
			v-if="showingCount && itemCount <= limit"
			class="item-count"
		>
			{{ showingCount }}
		</span>
	</transition>
	<!-- <v-button
            rounded
            icon
            class="publish"
            @click="router.push(`/content/publish/+`)"
    >
            <v-icon name="backup" filled />
    </v-button> -->
</template>
<style scoped>
    /* .publish {
        margin-right: 8px;
        --v-button-background-color: #9E8DE4;
        --v-button-color: white;
        --v-button-background-color-hover: #7C6BC2;
        --v-button-color-hover: white;
    } */

    .item-count {
        position: relative;
        display: none;
        margin: 0 8px;
        color: var(--theme--foreground-subdued);
        white-space: nowrap;
    }

    @media (min-width: 600px) {
        .item-count {
            display: inline;
        }
    }

    .fade-enter-active,
    .fade-leave-active {
        transition: opacity var(--medium) var(--transition);
    }

    .fade-enter-from,
    .fade-leave-to {
        opacity: 0;
    }
</style>