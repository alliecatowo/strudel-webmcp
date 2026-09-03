/** Pure loudness analysis over decoded PCM. No audio-graph access; unit-testable. */
export interface LoudnessAnalysis {
  durationMs: number;
  sampleRate: number;
  channels: number;
  /** Highest absolute sample, in dBFS (0 = full scale). */
  peakDbfs: number;
  /** Overall RMS in dBFS. */
  rmsDbfs: number;
  /** True when the clip never rises above roughly -60 dBFS. */
  silent: boolean;
  windowMs: number;
  /** RMS per consecutive window, in dBFS, in time order. */
  loudnessDbfs: number[];
}

export const SILENCE_DBFS = -60;

export function toDbfs(linear: number): number {
  if (!(linear > 0)) return -120;
  return Math.max(-120, Math.round(20 * Math.log10(linear) * 10) / 10);
}

/**
 * @param channels one Float32Array per channel, equal length
 */
export function analyzePcm(channels: Float32Array[], sampleRate: number, windowMs = 250): LoudnessAnalysis {
  const length = channels[0]?.length ?? 0;
  const chCount = Math.max(1, channels.length);
  const windowSize = Math.max(1, Math.round((sampleRate * windowMs) / 1000));
  let peak = 0;
  let sumSq = 0;
  const loudness: number[] = [];
  for (let start = 0; start < length; start += windowSize) {
    const end = Math.min(length, start + windowSize);
    let winSq = 0;
    for (const ch of channels) {
      for (let i = start; i < end; i++) {
        const v = ch[i] ?? 0;
        const a = Math.abs(v);
        if (a > peak) peak = a;
        winSq += v * v;
      }
    }
    const winSamples = (end - start) * chCount;
    sumSq += winSq;
    loudness.push(toDbfs(Math.sqrt(winSq / Math.max(1, winSamples))));
  }
  const rms = Math.sqrt(sumSq / Math.max(1, length * chCount));
  const peakDbfs = toDbfs(peak);
  return {
    durationMs: Math.round((length / Math.max(1, sampleRate)) * 1000),
    sampleRate,
    channels: channels.length,
    peakDbfs,
    rmsDbfs: toDbfs(rms),
    silent: peakDbfs <= SILENCE_DBFS,
    windowMs,
    loudnessDbfs: loudness,
  };
}

export function analyzeAudioBuffer(buffer: AudioBuffer, windowMs = 250): LoudnessAnalysis {
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c));
  return analyzePcm(channels, buffer.sampleRate, windowMs);
}
