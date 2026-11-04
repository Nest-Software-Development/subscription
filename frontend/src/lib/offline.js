import { clear, createStore, get, set } from 'idb-keyval'

const idbStore =
  typeof indexedDB !== 'undefined' ? createStore('subscription-pwa-db', 'snapshots') : null

export async function cacheGet(key) {
  if (!idbStore) return null
  try {
    return (await get(key, idbStore)) ?? null
  } catch {
    return null
  }
}

export async function cacheSet(key, value) {
  if (!idbStore) return
  try {
    await set(key, JSON.parse(JSON.stringify(value)), idbStore)
  } catch {
    // Ignore quota errors on private browsing
  }
}

export async function purgeLocalData() {
  try {
    if (idbStore) await clear(idbStore)
  } catch {}

  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((k) => k.startsWith('subscription-'))
          .map((k) => caches.delete(k)),
      )
    }
  } catch {}
}

