import { useEffect, useRef, useState } from 'react'
import { MAX_RECORDING_MS, recordingFormat } from './lib/audio'

export type RecorderStatus = 'idle' | 'starting' | 'recording' | 'paused'

/** A finished recording, kept in memory only. */
export interface Recording {
  blob: Blob
  durationMs: number
  /** With the extension providers tell the format by. */
  fileName: string
}

interface Session {
  recorder: MediaRecorder
  stream: MediaStream
  context: AudioContext | null
  chunks: Blob[]
  extension: string
  started: number
  pausedMs: number
  pausedAt: number | null
  frame: number
  timer: number
  /** Whether stopping should hand the recording over (not when leaving). */
  keep: boolean
}

/** Why the microphone couldn't be used, in words. */
function describeMicrophoneError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Momentum isn’t allowed to use the microphone. Allow it in the browser’s settings for this site, then try again.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError')
    return 'There’s no microphone to record with.'
  return 'The microphone couldn’t be started.'
}

const CANNOT_RECORD =
  'This browser can’t record audio. Choose a recording instead.'

export const canRecord = () =>
  typeof navigator !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  typeof MediaRecorder !== 'undefined'

/**
 * Records from the microphone: how long so far, how loud (for a meter),
 * pause and resume, and a stop that hands the recording over. It stops by
 * itself after an hour. Leaving the page drops a recording under way.
 */
export function useRecorder(onDone: (recording: Recording) => void) {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [level, setLevel] = useState(0)
  const [problem, setProblem] = useState<string | null>(null)
  const session = useRef<Session | null>(null)
  // Whether the page is still open: the microphone can be allowed after
  // it's left, and must then be let go of at once.
  const open = useRef(false)
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })

  const elapsedNow = (current: Session) =>
    performance.now() -
    current.started -
    current.pausedMs -
    (current.pausedAt === null ? 0 : performance.now() - current.pausedAt)

  function release(current: Session) {
    cancelAnimationFrame(current.frame)
    clearInterval(current.timer)
    for (const track of current.stream.getTracks()) track.stop()
    void current.context?.close().catch(() => {})
  }

  function stop() {
    const current = session.current
    if (!current || current.recorder.state === 'inactive') return
    current.recorder.stop()
  }

  async function start() {
    if (session.current) return
    setProblem(null)
    if (!canRecord()) {
      setProblem(CANNOT_RECORD)
      return
    }
    setStatus('starting')
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
    } catch (error) {
      if (!open.current) return
      setProblem(describeMicrophoneError(error))
      setStatus('idle')
      return
    }
    const stopTracks = () => {
      for (const track of stream.getTracks()) track.stop()
    }
    if (!open.current) {
      stopTracks()
      return
    }
    const format = recordingFormat((type) =>
      MediaRecorder.isTypeSupported(type),
    )
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(
        stream,
        format
          ? { mimeType: format.mimeType, audioBitsPerSecond: 32_000 }
          : undefined,
      )
    } catch {
      stopTracks()
      setProblem(CANNOT_RECORD)
      setStatus('idle')
      return
    }
    const current: Session = {
      recorder,
      stream,
      context: null,
      chunks: [],
      extension:
        format?.extension ??
        (recorder.mimeType.includes('mp4') ? 'mp4' : 'webm'),
      started: performance.now(),
      pausedMs: 0,
      pausedAt: null,
      frame: 0,
      timer: 0,
      keep: true,
    }
    session.current = current
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) current.chunks.push(event.data)
    }
    recorder.onstop = () => {
      const durationMs = elapsedNow(current)
      release(current)
      session.current = null
      setStatus('idle')
      setLevel(0)
      if (!current.keep) return
      done.current({
        blob: new Blob(current.chunks, {
          type: recorder.mimeType || format?.mimeType || 'audio/webm',
        }),
        durationMs,
        fileName: `recording.${current.extension}`,
      })
    }

    // The meter: how loud the last moment was.
    try {
      const context = new AudioContext()
      const analyser = context.createAnalyser()
      analyser.fftSize = 1024
      context.createMediaStreamSource(stream).connect(analyser)
      current.context = context
      const samples = new Float32Array(analyser.fftSize)
      const measure = () => {
        analyser.getFloatTimeDomainData(samples)
        let sum = 0
        for (const sample of samples) sum += sample * sample
        const loudness = Math.min(1, Math.sqrt(sum / samples.length) * 4)
        setLevel(current.pausedAt === null ? loudness : 0)
        current.frame = requestAnimationFrame(measure)
      }
      current.frame = requestAnimationFrame(measure)
    } catch {
      // No meter, still a recording.
    }

    current.timer = window.setInterval(() => {
      const ms = elapsedNow(current)
      setElapsed(ms)
      if (ms >= MAX_RECORDING_MS) stop()
    }, 250)
    try {
      recorder.start(1000)
    } catch {
      release(current)
      session.current = null
      setProblem(CANNOT_RECORD)
      setStatus('idle')
      return
    }
    setElapsed(0)
    setStatus('recording')
  }

  function pause() {
    const current = session.current
    if (!current || current.recorder.state !== 'recording') return
    current.recorder.pause()
    current.pausedAt = performance.now()
    setStatus('paused')
  }

  function resume() {
    const current = session.current
    if (!current || current.recorder.state !== 'paused') return
    current.recorder.resume()
    if (current.pausedAt !== null)
      current.pausedMs += performance.now() - current.pausedAt
    current.pausedAt = null
    setStatus('recording')
  }

  // Leaving the page drops a recording under way, and frees the microphone.
  useEffect(() => {
    open.current = true
    return () => {
      open.current = false
      const current = session.current
      if (!current) return
      current.keep = false
      if (current.recorder.state !== 'inactive') current.recorder.stop()
      else release(current)
    }
  }, [])

  return { status, elapsed, level, problem, start, pause, resume, stop }
}
