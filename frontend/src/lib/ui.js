import { reactive } from 'vue'
import { haptic } from './platform'

export const ui = reactive({
  toasts: [],
  confirm: null,
  paymentModal: null,
  subFormModal: null,
  emailPreviewModal: null,
  notifPermissionModal: false,
})

let toastSeq = 1

export function toast(message, tone = 'info', duration = 3200) {
  const id = toastSeq++
  if (tone === 'ok') haptic([10, 25, 10])
  else if (tone === 'bad') haptic([25, 40, 25])
  else haptic(8)

  ui.toasts.push({ id, message, tone })
  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration)
  }
  return id
}

export function dismissToast(id) {
  const idx = ui.toasts.findIndex((t) => t.id === id)
  if (idx !== -1) ui.toasts.splice(idx, 1)
}

export function askConfirm({
  title = 'Confirm action',
  body = 'Are you sure you want to continue?',
  okText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
} = {}) {
  haptic(15)
  return new Promise((resolve) => {
    ui.confirm = {
      title,
      body,
      okText,
      cancelText,
      danger,
      done(val) {
        ui.confirm = null
        resolve(Boolean(val))
      },
    }
  })
}

export function openPaymentSheet(opts = {}) {
  haptic(8)
  ui.paymentModal = { ...opts }
}

export function closePaymentSheet() {
  ui.paymentModal = null
}

export function openSubFormSheet(opts = {}) {
  haptic(8)
  ui.subFormModal = { ...opts }
}

export function closeSubFormSheet() {
  ui.subFormModal = null
}

export function openEmailPreviewSheet(opts = {}) {
  haptic(8)
  ui.emailPreviewModal = { ...opts }
}

export function closeEmailPreviewSheet() {
  ui.emailPreviewModal = null
}

export function openNotifPermissionSheet() {
  haptic(8)
  ui.notifPermissionModal = true
}

export function closeNotifPermissionSheet() {
  ui.notifPermissionModal = false
}
