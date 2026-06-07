/*
 * Pure download-rate math for the progress screen. The backend reports
 * cumulative bytesDownloaded and file counts; we derive a smoothed speed and a
 * file-based ETA from successive samples. Kept pure so it can be unit-tested.
 */

export interface SpeedState {
  lastT: number
  lastBytes: number
  /** Exponential moving average of bytes/sec. */
  ema: number
  started: boolean
}

export function initSpeed(): SpeedState {
  return { lastT: 0, lastBytes: 0, ema: 0, started: false }
}

/** Fold a new cumulative-bytes sample into the EMA. `now` is ms. */
export function pushSample(s: SpeedState, bytes: number, now: number): { state: SpeedState; bps: number } {
  if (!s.started) {
    return { state: { lastT: now, lastBytes: bytes, ema: 0, started: true }, bps: 0 }
  }
  const dt = (now - s.lastT) / 1000
  if (dt <= 0) return { state: s, bps: s.ema }
  const inst = Math.max(0, (bytes - s.lastBytes) / dt)
  const ema = s.ema === 0 ? inst : s.ema * 0.6 + inst * 0.4
  return { state: { lastT: now, lastBytes: bytes, ema, started: true }, bps: ema }
}

/**
 * File-based ETA in seconds, or null when it can't be estimated meaningfully
 * (no elapsed time, nothing processed yet, or total not ahead of processed —
 * e.g. while enumeration is still discovering posts).
 */
export function estimateEtaSec(
  elapsedSec: number,
  processed: number,
  total: number,
  startProcessed: number
): number | null {
  const done = processed - startProcessed
  if (elapsedSec <= 0 || done <= 0 || total <= processed) return null
  const rate = done / elapsedSec // files/sec
  if (rate <= 0) return null
  return (total - processed) / rate
}

export function formatSpeed(bps: number): string {
  const mb = bps / (1024 * 1024)
  return mb >= 0.05 ? `${mb.toFixed(1)} MB/s` : '—'
}

export function formatEta(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec)) return '—'
  const s = Math.round(sec)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}
