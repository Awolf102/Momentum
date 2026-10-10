/** The line on the share card, in the first person. */
export function shareMessage(streak: number): string {
  if (streak === 0) return 'Every streak starts with a single day.'
  if (streak === 1) return 'Day one. I showed up for myself today.'
  return `I've shown up for myself ${streak} days in a row.`
}

export function shareText(streak: number): string {
  return `🔥 ${streak}-day streak. Showing up every day with Momentum.`
}
