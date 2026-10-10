export {
  BackgroundSetting,
  LightSetting,
  ThemeSetting,
} from './components/AppearanceSettings'
export { BackgroundLayer } from './components/BackgroundLayer'
export { BackgroundVisual } from './components/BackgroundVisual'
export { useApplyTheme } from './hooks/useApplyTheme'
export { useCurrentBackground, useLight } from './hooks/useBackground'
export { usePhotoUrl } from './hooks/usePhotoUrl'
export { backgroundPanStore, PAN_TRANSITION, setBackgroundPan } from './pan'
export { useUnlockCelebrations } from './hooks/useUnlockCelebrations'
export {
  isUnlocked,
  listBackgrounds,
  REWARD_SCENES,
  resolveBackground,
} from './backgrounds'
export { drawGradient, type GradientLayer } from './lib/gradients'
export { listAllPhotos, loadPhoto, putPhoto } from './lib/photoStorage'
export {
  PHASE_LABELS,
  type Light,
  type PhotoGrade,
  type LightMode,
  type Phase,
} from './lib/light'
export {
  SCENE_HEIGHT,
  SCENE_TRAIL,
  SCENE_WIDTH,
  SCENES,
  type NormalizedPoint,
} from './scenes'
export {
  appearanceStore,
  setBackground,
  setLight,
  setTheme,
  toggleTheme,
} from './store'
export type { Background, ThemeMode } from './types'
