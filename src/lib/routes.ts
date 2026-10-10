import { navigate as navigateBrowser } from 'wouter/use-browser-location'

export const SETTINGS_SECTIONS = [
  'appearance',
  'focus',
  'app',
  'ai',
  'data',
] as const
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

export function isSettingsSection(value: string): value is SettingsSection {
  return (SETTINGS_SECTIONS as readonly string[]).includes(value)
}

/** Every screen's address, so links don't repeat path strings. */
export const paths = {
  home: '/',
  settings: (section?: SettingsSection) =>
    section ? `/settings/${section}` : '/settings',
}

/** Navigates from outside React (commands, toasts, hotkeys). */
export function navigate(path: string, options?: { replace?: boolean }): void {
  navigateBrowser(path, options)
}

export function openSettings(section?: SettingsSection): void {
  navigate(paths.settings(section))
}
