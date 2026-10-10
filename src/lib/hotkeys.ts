import { useEffect, useRef } from 'react'

export interface Hotkey {
  /** `KeyboardEvent.key`, compared case-insensitively (e.g. "c", "k", "?", ","). */
  key: string
  /** Requires ⌘ on Apple devices, Ctrl elsewhere. */
  mod?: boolean
  /** Still fires while a dialog is open (e.g. ⌘K to toggle the palette). */
  global?: boolean
}

export const isApple =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)

/** Human-readable keys for a hotkey, e.g. ["⌘", "K"] or ["Ctrl", "K"]. */
export function formatHotkey({ key, mod }: Hotkey): string[] {
  const label = key.length === 1 ? key.toUpperCase() : key
  return mod ? [isApple ? '⌘' : 'Ctrl', label] : [label]
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  )
}

export function matchesHotkey(
  event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey'>,
  hotkey: Hotkey,
): boolean {
  const mod = event.metaKey || event.ctrlKey
  if (hotkey.mod ? !mod : mod || event.altKey) return false
  return event.key.toLowerCase() === hotkey.key.toLowerCase()
}

/**
 * Global keyboard shortcuts. Plain-key shortcuts are ignored while typing in a
 * field or while a dialog is open, so they never get in the way.
 */
export function useHotkeys(
  bindings: ReadonlyArray<Hotkey & { run: () => void }>,
): void {
  // Read the latest bindings without re-attaching the listener on every render.
  const latest = useRef(bindings)
  useEffect(() => {
    latest.current = bindings
  })

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.repeat) return
      const dialogOpen = document.querySelector('[aria-modal="true"]') !== null
      for (const binding of latest.current) {
        if (!matchesHotkey(event, binding)) continue
        if (!binding.global && (dialogOpen || isEditable(event.target))) return
        event.preventDefault()
        binding.run()
        return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
