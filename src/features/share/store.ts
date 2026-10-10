import { createStore } from '@/lib/store'

export const shareOpenStore = createStore(false)
export const openShare = () => shareOpenStore.set(true)
export const closeShare = () => shareOpenStore.set(false)
