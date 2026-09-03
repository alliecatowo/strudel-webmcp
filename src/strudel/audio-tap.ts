import { StrudelError, aborted } from '../webmcp/errors';

/**
 * Master-output tap.
 *
 * Strudel's audio engine (superdough) keeps its master gain node module-private, but every
 * path to the speakers ends in `AudioNode.connect(context.destination)`. We observe those
 * connections once, at startup, and mirror each source into a per-context tap GainNode.
 * The tap never alters Strudel's graph or its gain; it only lets us record and measure
 * exactly what the human hears. This is the one place the app touches a platform prototype.
 */
export class MasterTap {
  private readonly taps = new Map<BaseAudioContext, GainNode>();
  private latest: BaseAudioContext | undefined;
  private installed = false;

  install(): void {
    if (this.installed) return;
    this.installed = true;
    const original = AudioNode.prototype.connect;
    const taps = this.taps;
    const self = this;
    AudioNode.prototype.connect = function connect(this: AudioNode, ...args: unknown[]) {
      const destination = args[0];
      if (destination instanceof AudioDestinationNode) {
        const ctx = destination.context;
        let tap = taps.get(ctx);
        if (!tap) {
          tap = ctx.createGain();
          taps.set(ctx, tap);
        }
        if (ctx instanceof AudioContext) self.latest = ctx;
        try {
          (original as (this: AudioNode, node: AudioNode) => AudioNode).call(this, tap);
        } catch {
          /* mirroring is best-effort; the real connection below must never be affected */
        }
      }
      return (original as (...a: unknown[]) => AudioNode | void).apply(this, args);
    } as typeof AudioNode.prototype.connect;
  }

  /**
   * The realtime audio context that reaches the speakers. Prefers Strudel's own user-facing
   * `getAudioContext()` global when it exists, otherwise the most recent running AudioContext seen.
   */
  get context(): AudioContext | undefined {
    const strudelCtx = (globalThis as { getAudioContext?: () => BaseAudioContext }).getAudioContext?.();
    if (strudelCtx instanceof AudioContext && this.taps.has(strudelCtx)) return strudelCtx;
    if (this.latest instanceof AudioContext && this.taps.has(this.latest)) return this.latest;
    for (const ctx of [...this.taps.keys()].reverse()) {
      if (ctx instanceof AudioContext) return ctx;
    }
    return undefined;
  }

  /** The tap node for the active context, if audio has ever been routed. */
  get node(): GainNode | undefined {
    const ctx = this.context;
    return ctx ? this.taps.get(ctx) : undefined;
  }
}

export interface RecordOptions {
  /** Hard stop after this many milliseconds. */
  maxMs: number;
  /** Optional graceful stop (e.g. the human pressing the Rec button again). Clip is kept. */
  until?: AbortSignal;
  /** Cancellation (WebMCP abort). Clip is discarded. */
  signal?: AbortSignal;
  /** Called every ~100 ms with elapsed milliseconds. */
  onTick?: (elapsedMs: number) => void;
  /** Record this node instead of the master tap (e.g. a Strudel `.analyze("id")` analyser). */
  sourceNode?: AudioNode;
}

export interface BandSnapshot {
  low: number;
  mid: number;
  high: number;
}

export interface Recording {
  blob: Blob;
  mimeType: string;
  buffer: AudioBuffer;
  /** Average analyser magnitude per band (dB, approximate), sampled during the recording. */
  bandsDb: BandSnapshot;
}

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];

export function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
}

/** Record the tapped master output. Resolves with the clip and its decoded PCM. */
export async function recordMaster(tap: MasterTap, options: RecordOptions): Promise<Recording> {
  const ctx = tap.context;
  const node = options.sourceNode ?? tap.node;
  if (!ctx || !node || ctx.state !== 'running') {
    throw new StrudelError('NOT_PLAYING', 'Nothing is playing. Start playback first, then record.', {
      audioContext: ctx ? ctx.state : 'none',
      tapped: Boolean(node),
    });
  }
  const mimeType = pickMimeType();
  if (!mimeType) throw new StrudelError('RECORDING_UNSUPPORTED', 'This browser cannot record audio (no MediaRecorder codec).');
  if (options.signal?.aborted) throw aborted();

  const stream = ctx.createMediaStreamDestination();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.3;
  node.connect(stream);
  node.connect(analyser);

  const recorder = new MediaRecorder(stream.stream, { mimeType });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const bands = { low: 0, mid: 0, high: 0, n: 0 };
  const spectrum = new Float32Array(analyser.frequencyBinCount);
  const binHz = ctx.sampleRate / analyser.fftSize;
  const started = performance.now();
  const ticker = setInterval(() => {
    analyser.getFloatFrequencyData(spectrum);
    const acc = { low: 0, mid: 0, high: 0 };
    const count = { low: 0, mid: 0, high: 0 };
    for (let i = 1; i < spectrum.length; i++) {
      const hz = i * binHz;
      const band = hz < 250 ? 'low' : hz < 2500 ? 'mid' : 'high';
      const v = spectrum[i] ?? -Infinity;
      if (Number.isFinite(v)) {
        acc[band] += v;
        count[band]++;
      }
    }
    if (count.low) bands.low += acc.low / count.low;
    if (count.mid) bands.mid += acc.mid / count.mid;
    if (count.high) bands.high += acc.high / count.high;
    bands.n++;
    options.onTick?.(performance.now() - started);
  }, 100);

  const cleanup = () => {
    clearInterval(ticker);
    try {
      node.disconnect(stream);
      node.disconnect(analyser);
    } catch {
      /* already disconnected */
    }
  };

  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  let cancelled = false;
  const finish = () => {
    if (recorder.state !== 'inactive') recorder.stop();
  };
  const timer = setTimeout(finish, Math.max(100, options.maxMs));
  options.until?.addEventListener('abort', finish, { once: true });
  options.signal?.addEventListener(
    'abort',
    () => {
      cancelled = true;
      finish();
    },
    { once: true },
  );

  recorder.start(250);
  await stopped;
  clearTimeout(timer);
  cleanup();
  if (cancelled) throw aborted();

  const blob = new Blob(chunks, { type: mimeType });
  if (blob.size === 0) throw new StrudelError('RECORDING_UNSUPPORTED', 'The recorder produced no data.');
  const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
  const n = bands.n || 1;
  return {
    blob,
    mimeType,
    buffer,
    bandsDb: { low: round(bands.low / n), mid: round(bands.mid / n), high: round(bands.high / n) },
  };
}

function round(v: number): number {
  return Number.isFinite(v) ? Math.round(v * 10) / 10 : -120;
}

/**
 * A single voice: Strudel routes any pattern carrying `.analyze("id")` through an AnalyserNode it
 * keeps in the user-facing `analysers` global. Recording that node isolates the voice.
 */
export function resolveAnalyser(id: string): AudioNode {
  const analysers = (globalThis as { analysers?: Record<string, AudioNode> }).analysers;
  const node = analysers?.[id];
  if (!node) {
    throw new StrudelError('INVALID_INPUT', `No voice is tagged .analyze("${id}"). Add .analyze("${id}") to the pattern you want to isolate, evaluate, then record with source "${id}".`, {
      available: Object.keys(analysers ?? {}),
    });
  }
  return node;
}
