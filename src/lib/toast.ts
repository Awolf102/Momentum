import type { ReactNode } from 'react'
import { createId } from './id'
import { createStore } from './store'

export interface Toast {
  id: string
  title: string
  description?: string
  icon?: ReactNode
  action?: { label: string; run: () => void }
  /** Milliseconds before it disappears; `Infinity` keeps it until dismissed. */
  duration: number
}

export const toastStore = createStore<Toast[]>([])

/** Shows a toast. Passing an existing `id` replaces that toast instead of stacking. */
export function toast(
  input: Omit<Toast, 'id' | 'duration'> & { id?: string; duration?: number },
): string {
  const next: Toast = { duration: 5000, ...input, id: input.id ?? createId() }
  toastStore.set((toasts) => [
    ...toasts.filter((existing) => existing.id !== next.id),
    next,
  ])
  return next.id
}

export function dismissToast(id: string): void {
  toastStore.set((toasts) => toasts.filter((existing) => existing.id !== id))
}
