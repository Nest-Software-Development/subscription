import { createRouter, createWebHistory } from 'vue-router'
import { store } from './lib/store'

import PulseView from './views/PulseView.vue'
import SubscriptionsView from './views/SubscriptionsView.vue'
import ClientDetailView from './views/ClientDetailView.vue'
import VendorDetailView from './views/VendorDetailView.vue'
import CalendarView from './views/CalendarView.vue'
import WalletsView from './views/WalletsView.vue'
import AlertsView from './views/AlertsView.vue'
import LoginView from './views/LoginView.vue'

const routerBase =
  typeof window !== 'undefined' && window.location.pathname.startsWith('/subscriptions')
    ? '/subscriptions'
    : '/'

export function hasTabBar(route) {
  return Boolean(route?.meta?.tab)
}

export const router = createRouter({
  history: createWebHistory(routerBase),
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0 }
  },
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { title: 'Sign In', guest: true },
    },
    {
      path: '/',
      name: 'pulse',
      component: PulseView,
      meta: { title: 'Pulse', tab: true },
    },
    {
      path: '/list',
      name: 'list',
      component: SubscriptionsView,
      meta: { title: 'Subscriptions', tab: true },
    },
    {
      path: '/client/:id',
      name: 'client-detail',
      component: ClientDetailView,
      meta: { title: 'Client Subscription', tab: false },
    },
    {
      path: '/vendor/:id',
      name: 'vendor-detail',
      component: VendorDetailView,
      meta: { title: 'Vendor Subscription', tab: false },
    },
    {
      path: '/calendar',
      name: 'calendar',
      component: CalendarView,
      meta: { title: 'Renewal Timeline', tab: true },
    },
    {
      path: '/wallets',
      name: 'wallets',
      component: WalletsView,
      meta: { title: 'Wallets & Reports', tab: true },
    },
    {
      path: '/alerts',
      name: 'alerts',
      component: AlertsView,
      meta: { title: 'Alerts & Settings', tab: true },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach((to) => {
  if (!store.ready) return true
  if (!store.authenticated && !to.meta?.guest) {
    return { name: 'login' }
  }
  if (store.authenticated && to.name === 'login') {
    return { name: 'pulse' }
  }
  return true
})

