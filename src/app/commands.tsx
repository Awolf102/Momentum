import { useMemo } from 'react'
import type { Command } from '@/lib/commands'
import {
  CheckIcon,
  DownloadIcon,
  BellIcon,
  ImageIcon,
  InstallIcon,
  KeyboardIcon,
  MoonIcon,
  MountainIcon,
  PencilIcon,
  ShareIcon,
  VolumeIcon,
  SlidersIcon,
  SunIcon,
  SunriseIcon,
} from '@/components/icons'
import {
  appearanceStore,
  isUnlocked,
  listBackgrounds,
  setBackground,
  setLight,
  toggleTheme,
} from '@/features/appearance'
import {
  ambienceStore,
  playingStore,
  SOUNDS,
  playSound,
  togglePlaying,
  toggleSound,
  type SoundId,
} from '@/features/ambience'
import { startTracing, toggleClimb } from '@/features/climb'
import { installStore, promptInstall } from '@/features/pwa'
import { reminderStore } from '@/features/reminder'
import { exportBackup, openSettings } from '@/features/settings'
import { openShare } from '@/features/share'
import { checkIn } from '@/features/streak'
import { useProgress } from '@/lib/progress'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'
import { openShortcuts } from './overlays'

function checkInFromShortcut() {
  if (!checkIn()) {
    toast({
      id: 'already-checked-in',
      icon: <CheckIcon className="text-orange-300" />,
      title: 'Already checked in today',
      description: 'See you tomorrow.',
      duration: 2500,
    })
  }
}

/**
 * Every action the app offers, in one list. The command palette shows them;
 * the ones with a hotkey are also bound to the keyboard.
 */
export function useAppCommands(): Command[] {
  const { theme, photos } = useStore(appearanceStore)
  const { longest } = useProgress()
  const playing = useStore(playingStore)
  const { sounds } = useStore(ambienceStore)
  const { canPrompt } = useStore(installStore)
  const reminder = useStore(reminderStore)

  return useMemo(() => {
    const backgrounds = listBackgrounds(photos).filter((background) =>
      isUnlocked(background, longest),
    )
    return [
      {
        id: 'check-in',
        title: 'Check in for today',
        section: 'Streak',
        icon: <CheckIcon />,
        keywords: ['done', 'complete', 'streak'],
        hotkey: { key: 'c' },
        run: checkInFromShortcut,
      },
      {
        id: 'climb',
        title: 'View the climb',
        section: 'Streak',
        icon: <MountainIcon />,
        keywords: ['mountain', 'summit', 'progress', 'trail'],
        hotkey: { key: 'm' },
        run: toggleClimb,
      },
      {
        id: 'share',
        title: 'Share streak card',
        section: 'Streak',
        icon: <ShareIcon />,
        keywords: ['image', 'export', 'post', 'instagram', 'picture'],
        hotkey: { key: 's' },
        run: openShare,
      },
      {
        id: 'trace',
        title: 'Trace the trail on this background',
        section: 'Streak',
        icon: <PencilIcon />,
        keywords: ['climb', 'ridge', 'route', 'draw'],
        run: startTracing,
      },
      {
        id: 'settings',
        title: 'Open settings',
        section: 'General',
        icon: <SlidersIcon />,
        keywords: ['preferences', 'options'],
        hotkey: { key: ',' },
        run: openSettings,
      },
      {
        id: 'theme',
        title:
          theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        section: 'General',
        icon: theme === 'dark' ? <SunIcon /> : <MoonIcon />,
        keywords: ['dark mode', 'light mode', 'appearance'],
        hotkey: { key: 't' },
        run: toggleTheme,
      },
      {
        id: 'shortcuts',
        title: 'Keyboard shortcuts',
        section: 'General',
        icon: <KeyboardIcon />,
        keywords: ['help', 'keys', 'hotkeys'],
        hotkey: { key: '?' },
        run: openShortcuts,
      },
      {
        id: 'reminder',
        title: reminder.enabled
          ? `Evening reminder: on at ${reminder.time}`
          : 'Set an evening reminder',
        section: 'General',
        icon: <BellIcon />,
        keywords: ['notification', 'notify', 'alert', 'remind'],
        run: openSettings,
      },
      ...(canPrompt
        ? [
            {
              id: 'install',
              title: 'Install Momentum as an app',
              section: 'General',
              icon: <InstallIcon />,
              keywords: ['pwa', 'home screen', 'offline', 'download'],
              run: () => void promptInstall(),
            },
          ]
        : []),
      {
        id: 'export',
        title: 'Export backup',
        section: 'General',
        icon: <DownloadIcon />,
        keywords: ['download', 'save', 'data'],
        run: exportBackup,
      },
      {
        id: 'sound',
        title: playing ? 'Pause ambient sound' : 'Play ambient sound',
        section: 'Sound',
        icon: <VolumeIcon />,
        keywords: ['music', 'focus', 'study', 'audio', 'mute'],
        hotkey: { key: 'a' },
        run: togglePlaying,
      },
      ...(Object.keys(SOUNDS) as SoundId[]).map((id) => ({
        id: `sound-${id}`,
        title: `${sounds.includes(id) && playing ? 'Stop' : 'Play'} ${SOUNDS[id].label.toLowerCase()}`,
        section: 'Sound',
        icon: <VolumeIcon />,
        keywords: ['ambient', 'ambience', 'noise', 'study'],
        run: () =>
          sounds.includes(id) && playing ? toggleSound(id) : playSound(id),
      })),
      ...(
        [
          ['time', 'Light: follow the time of day'],
          ['streak', 'Light: warm with my streak'],
          ['off', 'Light: off'],
        ] as const
      ).map(([mode, title]) => ({
        id: `light-${mode}`,
        title,
        section: 'Light',
        icon: <SunriseIcon />,
        keywords: ['dawn', 'dusk', 'golden hour', 'sky'],
        run: () => setLight(mode),
      })),
      ...backgrounds.map((background) => ({
        id: `background-${background.id}`,
        title: `Background: ${background.name}`,
        section: 'Backgrounds',
        icon: <ImageIcon />,
        keywords: ['photo', 'wallpaper', 'scene'],
        run: () => setBackground(background.id),
      })),
    ]
  }, [theme, photos, longest, playing, sounds, canPrompt, reminder])
}
