import type { OffsetChange } from './editor';
import type { OffsetRange, SourceRange } from './types';

/** How much the human lets the agent do. Chosen by the human, read by the agent. */
export type AgentMode = 'read' | 'review' | 'live';

export const AGENT_MODES: readonly AgentMode[] = ['read', 'review', 'live'];

export interface Proposal {
  id: string;
  /** Agent-supplied one-line summary shown to the human. */
  summary: string;
  kind: 'edits' | 'replace';
  /** Hash of the document the proposal was computed against. */
  baseCodeHash: string;
  /** Changes on the base document (sorted, non-overlapping). */
  changes: OffsetChange[];
  /** The full document after applying the proposal. */
  code: string;
  /** Zero-based inclusive line span touched in the base document. */
  lineRange: { start: number; end: number };
  createdAt: number;
}

export interface SoloState {
  range: SourceRange & OffsetRange;
}

export interface RecordingState {
  by: 'agent' | 'human';
  label: string;
  startedAt: number;
  /** Graceful stop: keeps the clip. */
  stop: () => void;
}

export interface Snapshot {
  id: string;
  label: string;
  code: string;
  codeHash: string;
  createdAt: number;
}

export interface LoadedSample {
  name: string;
  source: 'human' | 'agent';
  durationMs?: number;
}

export interface SessionState {
  mode: AgentMode;
  proposal?: Proposal;
  /** True while the proposal's code (not the visible document) is what is sounding. */
  auditioning: boolean;
  solo?: SoloState;
  recording?: RecordingState;
  snapshots: Snapshot[];
  samples: LoadedSample[];
}

const MODE_KEY = 'strudel-webmcp:agent-mode';
const MAX_SNAPSHOTS = 20;

/**
 * Small observable store for state that is neither the Strudel document nor the scheduler:
 * the human's permission mode, the pending proposal, solo/audition/recording status, versions.
 * Emits `change` after every mutation. No agent is ever woken by it.
 */
export class Session extends EventTarget {
  private st: SessionState;

  constructor(initialMode?: AgentMode) {
    super();
    this.st = {
      mode: initialMode ?? readPersistedMode(),
      auditioning: false,
      snapshots: [],
      samples: [],
    };
  }

  get state(): Readonly<SessionState> {
    return this.st;
  }

  private commit(patch: Partial<SessionState>): void {
    this.st = { ...this.st, ...patch };
    this.dispatchEvent(new CustomEvent('change', { detail: this.st }));
  }

  setMode(mode: AgentMode): void {
    if (!AGENT_MODES.includes(mode)) throw new RangeError(`unknown mode ${mode}`);
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      /* private mode / disabled storage */
    }
    this.commit({ mode });
  }

  setProposal(proposal: Proposal | undefined): void {
    this.commit({ proposal, auditioning: false });
  }

  setAuditioning(auditioning: boolean): void {
    this.commit({ auditioning });
  }

  setSolo(solo: SoloState | undefined): void {
    this.commit({ solo });
  }

  setRecording(recording: RecordingState | undefined): void {
    this.commit({ recording });
  }

  addSnapshot(snapshot: Snapshot): void {
    this.commit({ snapshots: [snapshot, ...this.st.snapshots].slice(0, MAX_SNAPSHOTS) });
  }

  removeSnapshot(id: string): void {
    this.commit({ snapshots: this.st.snapshots.filter((s) => s.id !== id) });
  }

  addSamples(samples: LoadedSample[]): void {
    const byName = new Map(this.st.samples.map((s) => [s.name, s]));
    for (const s of samples) byName.set(s.name, s);
    this.commit({ samples: [...byName.values()] });
  }
}

function readPersistedMode(): AgentMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v && (AGENT_MODES as readonly string[]).includes(v)) return v as AgentMode;
  } catch {
    /* ignore */
  }
  return 'live';
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
