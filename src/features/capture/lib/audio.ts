/** Formats browsers record in that providers read, best first. */
const RECORDING_FORMATS = [
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
  { mimeType: 'audio/webm', extension: 'webm' },
  // Safari records AAC in MP4.
  { mimeType: 'audio/mp4', extension: 'mp4' },
  { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
] as const

export type RecordingFormat = (typeof RECORDING_FORMATS)[number]

/** The first format this browser can record in; null to let it choose. */
export function recordingFormat(
  supported: (mimeType: string) => boolean,
): RecordingFormat | null {
  return RECORDING_FORMATS.find((format) => supported(format.mimeType)) ?? null
}

const EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'video/webm': 'webm',
  'audio/mp4': 'mp4',
  'video/mp4': 'mp4',
  'audio/x-m4a': 'm4a',
  'audio/m4a': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
}

/**
 * The extension a provider tells a recording's format by: from the file's
 * name when it has one it reads, otherwise from its type. Null for a
 * format it doesn't read.
 */
export function audioExtension(type: string, name = ''): string | null {
  const named = /\.(flac|mp3|mp4|mpeg|mpga|m4a|ogg|oga|wav|webm)$/i.exec(
    name,
  )?.[1]
  if (named) return named.toLowerCase()
  return EXTENSIONS[type.split(';')[0].trim().toLowerCase()] ?? null
}

/** The most a provider takes in one request (OpenAI's limit, 25 MB). */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024
/** Recordings stop here: an hour of speech is well within that size. */
export const MAX_RECORDING_MS = 60 * 60_000

/** A length as a clock: "0:07", "3:20", "1:02:03". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = String(total % 60).padStart(2, '0')
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`
}

/** A length in words: "45 s", "3 min 20 s", "1 h 2 min". */
export function describeDuration(ms: number): string {
  const total = Math.max(1, Math.round(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours) return minutes ? `${hours} h ${minutes} min` : `${hours} h`
  if (minutes) return seconds ? `${minutes} min ${seconds} s` : `${minutes} min`
  return `${seconds} s`
}

export const countWords = (text: string) =>
  text.trim() ? text.trim().split(/\s+/).length : 0
