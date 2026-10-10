// Goals without their screens, for lazy code that only reads or clears them
// (search, Settings). Importing the index there would tie the dashboard
// card's habits and tasks into those chunks, and the bundler splits the
// first load into more, less compressible files.
export { goals, sortGoals } from './goals'
export type { Goal, GoalStatus, Milestone } from './types'
