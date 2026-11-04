<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { loginWithCredentials, verifyTwoFactor } from '@/lib/store'
import { toast } from '@/lib/ui'

const router = useRouter()
const busy = ref(false)
const twoFactor = reactive({
  active: false,
  tmpId: '',
  otp: '',
})
const form = reactive({
  usr: '',
  pwd: '',
})

async function submitLogin() {
  if (!form.usr.trim() || !form.pwd) {
    toast('Enter your email/username and password.', 'bad')
    return
  }
  busy.value = true
  try {
    const res = await loginWithCredentials(form.usr.trim(), form.pwd)
    if (res?.two_factor_required) {
      twoFactor.active = true
      twoFactor.tmpId = res.tmp_id
      toast('Enter your 2FA verification code.', 'info')
    } else {
      toast('Welcome back!', 'ok')
      router.replace('/')
    }
  } catch (err) {
    toast(err.message || 'Invalid credentials.', 'bad')
  } finally {
    busy.value = false
  }
}

async function submitOtp() {
  if (!twoFactor.otp.trim()) return
  busy.value = true
  try {
    await verifyTwoFactor(twoFactor.tmpId, twoFactor.otp.trim())
    toast('Signed in!', 'ok')
    router.replace('/')
  } catch (err) {
    toast(err.message || 'Invalid verification code.', 'bad')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main
    data-dark-screen
    class="flex min-h-[100dvh] flex-col justify-between bg-obsidian-950 px-5 py-10 text-white pt-safe pb-safe"
  >
    <div class="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
      <!-- Brand Header -->
      <div class="mb-8 flex flex-col items-center text-center">
        <div
          class="mb-4 h-20 w-20 overflow-hidden rounded-[22px] shadow-[0_20px_48px_-10px_rgba(255,87,87,0.48)] ring-1 ring-white/15"
        >
          <img
            src="/assets/subscription/images/subscription-logo-512.png"
            alt="Subscription logo"
            class="h-full w-full object-cover"
          />
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-white">Subscription</h1>
        <p class="mt-1 text-sm text-white/65">
          Recurring Revenue, Multi-Client Vendor Costs &amp; Renewal Push Alerts
        </p>
      </div>

      <!-- Sign-In Card -->
      <form
        v-if="!twoFactor.active"
        class="space-y-4 rounded-3xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur-md"
        @submit.prevent="submitLogin"
      >
        <div class="space-y-1.5">
          <label class="text-xs font-semibold uppercase tracking-wider text-white/70">
            ERPNext Email or Username
          </label>
          <input
            v-model="form.usr"
            type="text"
            autocomplete="username"
            placeholder="info@nsd-eg.com"
            class="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-base text-white outline-none placeholder:text-white/35 focus:border-coral-400"
          />
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-semibold uppercase tracking-wider text-white/70">
            Password
          </label>
          <input
            v-model="form.pwd"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            class="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-base text-white outline-none placeholder:text-white/35 focus:border-coral-400"
          />
        </div>

        <button type="submit" class="btn-primary mt-2 w-full" :disabled="busy">
          {{ busy ? 'Signing in…' : 'Sign In to Subscription' }}
        </button>
      </form>

      <!-- 2FA OTP Form -->
      <form
        v-else
        class="space-y-4 rounded-3xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur-md"
        @submit.prevent="submitOtp"
      >
        <p class="text-sm text-white/80">
          Enter the one-time verification code sent to your authenticator or email.
        </p>
        <input
          v-model="twoFactor.otp"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          placeholder="6-digit code"
          class="tabular w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-center text-xl font-bold tracking-widest text-white outline-none focus:border-coral-400"
        />
        <button type="submit" class="btn-primary w-full" :disabled="busy">
          {{ busy ? 'Verifying…' : 'Verify & Continue' }}
        </button>
      </form>
    </div>

    <p class="text-center text-xs tracking-wider text-white/45">
      nsdLabs · Nest Software Development · ERPNext v16.52
    </p>
  </main>
</template>

