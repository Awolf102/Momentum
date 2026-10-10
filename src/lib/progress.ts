import { createContext, useContext } from 'react'

/** Streak progress, provided by the app so lower-level features needn't know about streaks. */
export interface Progress {
  current: number
  longest: number
}

export const ProgressContext = createContext<Progress>({
  current: 0,
  longest: 0,
})

export function useProgress(): Progress {
  return useContext(ProgressContext)
}
