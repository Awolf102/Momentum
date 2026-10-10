import { useSyncExternalStore } from 'react'

/** A minimal observable value, readable from React with `useStore`. */
export interface Store<T> {
  get(): T
  set(next: T | ((previous: T) => T)): void
  subscribe(listener: () => void): () => void
}

/** In-memory state shared across components (UI state that shouldn't persist). */
export function createStore<T>(initial: T): Store<T> {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    set(next) {
      const value =
        typeof next === 'function' ? (next as (previous: T) => T)(state) : next
      if (Object.is(value, state)) return
      state = value
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** Subscribes a component to a store. */
export function useStore<T>(store: Pick<Store<T>, 'get' | 'subscribe'>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}
