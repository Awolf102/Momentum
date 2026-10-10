import { useMemo } from 'react'
import type { Command } from '@/lib/commands'
import {
  BellIcon,
  BookIcon,
  ChecklistIcon,
  ColumnsIcon,
  ListIcon,
  CheckIcon,
  DatabaseIcon,
  DownloadIcon,
  HomeIcon,
  ImageIcon,
  InstallIcon,
  KeyboardIcon,
  MoonIcon,
  MountainIcon,
  PaletteIcon,
  PauseIcon,
  PlayIcon,
  PencilIcon,
  PlusIcon,
  ShareIcon,
  SkipIcon,
  SlidersIcon,
  SparkleIcon,
  SunIcon,
  SunriseIcon,
  TimerIcon,
  VolumeIcon,
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
import {
  cancelFocus,
  focusTimerStore,
  skipBreak,
  startFocus,
  toggleFocus,
} from '@/features/focus'
import { writeLine } from '@/features/log'
import { openQuickAdd, setTasksView, tasksViewStore } from '@/features/tasks'
import { installStore, promptInstall } from '@/features/pwa'
import { reminderStore } from '@/features/reminder'
import { openShare } from '@/features/share'
import { liveSubjects, subjectsStore } from '@/features/subjects'
import { checkIn } from '@/features/streak'
import { openShortcuts } from '@/lib/overlays'
import { useProgress } from '@/lib/progress'
import { navigate, openSettings, paths } from '@/lib/routes'
import { toDateKey } from '@/lib/date'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'

function checkInFromShortcut() {
  // Check in on the dashboard, where the celebration plays.
  if (window.location.pathname !== paths.home) {
    navigate(paths.home)
    requestAnimationFrame(checkInFromShortcut)
    return
  }
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
  const { phase } = useStore(focusTimerStore)
  const subjects = useStore(subjectsStore)
  const { view: tasksView } = useStore(tasksViewStore)

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
        id: 'focus',
        title: !phase
          ? 'Start a focus session'
          : phase.pausedAt !== null
            ? phase.kind === 'focus'
              ? 'Resume focus session'
              : 'Resume break'
            : phase.kind === 'focus'
              ? 'Pause focus session'
              : 'Pause break',
        section: 'Focus',
        icon: !phase || phase.pausedAt !== null ? <PlayIcon /> : <PauseIcon />,
        keywords: ['pomodoro', 'timer', 'study', 'work', 'session'],
        hotkey: { key: 'f' },
        run: toggleFocus,
      },
      ...(phase && phase.kind !== 'focus'
        ? [
            {
              id: 'focus-skip-break',
              title: 'Skip break and start focusing',
              section: 'Focus',
              icon: <SkipIcon />,
              keywords: ['pomodoro', 'timer', 'next'],
              run: skipBreak,
            },
          ]
        : []),
      ...(phase?.kind === 'focus'
        ? [
            {
              id: 'focus-cancel',
              title: "Cancel focus session (it won't count)",
              section: 'Focus',
              icon: <TimerIcon />,
              keywords: ['stop', 'abandon', 'pomodoro'],
              run: cancelFocus,
            },
          ]
        : []),
      ...(!phase
        ? liveSubjects(subjects).map((subject) => ({
            id: `focus-on-${subject.id}`,
            title: `Focus on ${subject.name}`,
            section: 'Focus',
            icon: <TimerIcon />,
            keywords: ['start', 'pomodoro', 'timer', 'study', 'subject'],
            run: () => startFocus(subject.id),
          }))
        : []),
      {
        id: 'task-add',
        title: 'Add a task',
        section: 'Tasks',
        icon: <PlusIcon />,
        keywords: ['todo', 'new', 'quick add', 'create', 'reminder'],
        hotkey: { key: 'n' },
        run: openQuickAdd,
      },
      {
        id: 'tasks-view',
        title:
          tasksView === 'board'
            ? 'Show tasks as a list'
            : 'Show tasks as a board',
        section: 'Tasks',
        icon: tasksView === 'board' ? <ListIcon /> : <ColumnsIcon />,
        keywords: ['kanban', 'columns', 'board', 'list', 'view'],
        run: () => {
          setTasksView(tasksView === 'board' ? 'list' : 'board')
          navigate(paths.tasks)
        },
      },
      {
        id: 'log-today',
        title: "Write today's line",
        section: 'Log',
        icon: <PencilIcon />,
        keywords: ['log', 'journal', 'diary', 'note', 'reflect', 'today'],
        hotkey: { key: 'l' },
        run: () => writeLine(toDateKey(new Date())),
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
        id: 'go-home',
        title: 'Go to Home',
        section: 'Go to',
        icon: <HomeIcon />,
        keywords: ['dashboard', 'today', 'streak'],
        run: () => navigate(paths.home),
      },
      {
        id: 'go-tasks',
        title: 'Go to Tasks',
        section: 'Go to',
        icon: <ChecklistIcon />,
        keywords: ['todo', 'list', 'board', 'kanban', 'due'],
        run: () => navigate(paths.tasks),
      },
      {
        id: 'go-log',
        title: 'Go to Log',
        section: 'Go to',
        icon: <BookIcon />,
        keywords: ['journal', 'diary', 'history', 'lines', 'days'],
        run: () => navigate(paths.log),
      },
      {
        id: 'settings',
        title: 'Open settings',
        section: 'Go to',
        icon: <SlidersIcon />,
        keywords: ['preferences', 'options'],
        hotkey: { key: ',' },
        run: () => openSettings(),
      },
      {
        id: 'settings-appearance',
        title: 'Appearance settings',
        section: 'Go to',
        icon: <PaletteIcon />,
        keywords: ['theme', 'background', 'photo', 'light'],
        run: () => openSettings('appearance'),
      },
      {
        id: 'settings-focus',
        title: 'Focus settings: lengths, sound and subjects',
        section: 'Go to',
        icon: <TimerIcon />,
        keywords: ['pomodoro', 'break', 'timer', 'subjects', 'labels'],
        run: () => openSettings('focus'),
      },
      {
        id: 'settings-ai',
        title: 'AI settings: providers, keys and models',
        section: 'Go to',
        icon: <SparkleIcon />,
        keywords: [
          'anthropic',
          'claude',
          'openai',
          'gpt',
          'ollama',
          'api key',
          'model',
          'usage',
          'cost',
        ],
        run: () => openSettings('ai'),
      },
      {
        id: 'settings-data',
        title: 'Data and backup',
        section: 'Go to',
        icon: <DatabaseIcon />,
        keywords: ['export', 'import', 'storage', 'restore', 'reset'],
        run: () => openSettings('data'),
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
        run: () => openSettings('app'),
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
        // Loaded on demand: backup code isn't needed to start the app.
        run: () =>
          void import('@/features/backup').then(({ downloadBackup }) =>
            downloadBackup({ includeSecrets: false }),
          ),
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
  }, [
    theme,
    photos,
    longest,
    playing,
    sounds,
    canPrompt,
    reminder,
    phase,
    subjects,
    tasksView,
  ])
}
