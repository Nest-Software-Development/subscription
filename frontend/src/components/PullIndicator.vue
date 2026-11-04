<script setup>
import { pull } from '@/lib/refresh'
</script>

<template>
  <div
    v-if="pull.distance > 4 || pull.refreshing"
    class="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+3.5rem)] z-40 flex justify-center transition-transform duration-150"
    :style="{ transform: `translateY(${Math.min(pull.distance * 0.45, 36)}px)` }"
    aria-live="polite"
  >
    <div
      class="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface shadow-md"
    >
      <svg
        class="h-4 w-4 text-coral-600 dark:text-coral-400"
        :class="pull.refreshing ? 'animate-spin' : ''"
        :style="!pull.refreshing ? { transform: `rotate(${pull.distance * 3}deg)` } : undefined"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    </div>
  </div>
</template>

