<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useLayer } from '@/lib/layers'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  maxWidth: { type: String, default: 'max-w-lg' },
})

const emit = defineEmits(['close'])

const isOpen = computed(() => props.open)
useLayer(isOpen, () => emit('close'))

const dragY = ref(0)
const dragging = ref(false)
let startY = 0

function onGrabStart(e) {
  const y = e.touches ? e.touches[0].clientY : e.clientY
  startY = y
  dragging.value = true
  dragY.value = 0
}

function onGrabMove(e) {
  if (!dragging.value) return
  const y = e.touches ? e.touches[0].clientY : e.clientY
  dragY.value = Math.max(0, y - startY)
}

function onGrabEnd() {
  if (!dragging.value) return
  dragging.value = false
  if (dragY.value > 92) {
    dragY.value = 0
    emit('close')
  } else {
    dragY.value = 0
  }
}

function onKeyDown(e) {
  if (e.key === 'Escape' && props.open) emit('close')
}

watch(
  () => props.open,
  (val) => {
    document.body.style.overflow = val ? 'hidden' : ''
  },
)

onMounted(() => window.addEventListener('keydown', onKeyDown))
onBeforeUnmount(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]"
        aria-hidden="true"
        @click="emit('close')"
      />
    </Transition>

    <Transition name="sheet">
      <div
        v-if="open"
        role="dialog"
        aria-modal="true"
        :aria-label="title || 'Sheet'"
        class="sheet-panel fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full flex-col rounded-t-[1.75rem] border-t border-line bg-surface shadow-sheet sm:bottom-4 sm:rounded-[1.75rem] sm:border"
        :class="[maxWidth, { 'is-dragging': dragging }]"
        :style="dragY > 0 ? { transform: `translateY(${dragY}px)` } : undefined"
      >
        <!-- 44pt Accessible Grabber Hit Target -->
        <div
          class="flex min-h-[32px] cursor-grab items-center justify-center pt-2.5 pb-1 touch-none"
          @touchstart.passive="onGrabStart"
          @touchmove.passive="onGrabMove"
          @touchend="onGrabEnd"
          @mousedown="onGrabStart"
          @mousemove="onGrabMove"
          @mouseup="onGrabEnd"
        >
          <span class="h-1.5 w-10 rounded-full bg-ink-mute/35" />
        </div>

        <!-- Sheet Header -->
        <div class="flex items-start justify-between gap-3 border-b border-line/70 px-5 pb-3.5 pt-1">
          <div class="min-w-0">
            <h2 class="text-[1.125rem] font-bold tracking-tight text-ink">
              {{ title }}
            </h2>
            <p v-if="subtitle" class="mt-0.5 text-[0.8125rem] text-ink-soft">
              {{ subtitle }}
            </p>
          </div>
          <button
            type="button"
            class="icon-btn -mr-2 -mt-1 bg-surface-sunk/80"
            aria-label="Close"
            @click="emit('close')"
          >
            <svg
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Scrollable Body -->
        <div class="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          <slot />
        </div>

        <!-- Optional Sticky Footer -->
        <div
          v-if="$slots.footer"
          class="border-t border-line/70 bg-surface px-5 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]"
        >
          <slot name="footer" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

