import { createStore } from '@/lib/store'

/**
 * Horizontal pan of the background, in pixels. Normally 0 (centred); the
 * climb view pans so a route that's cropped on narrow screens comes into view.
 * Anything drawn over the background should apply the same pan.
 */
export const backgroundPanStore = createStore(0)

export const setBackgroundPan = (pixels: number) =>
  backgroundPanStore.set(Math.round(pixels))

/** Shared so overlays move in step with the background. */
export const PAN_DURATION = 700
export const PAN_EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)'
export const PAN_EASING_POINTS = [0.2, 0.8, 0.2, 1] as const
export const PAN_TRANSITION = `transform ${PAN_DURATION}ms ${PAN_EASING}`
