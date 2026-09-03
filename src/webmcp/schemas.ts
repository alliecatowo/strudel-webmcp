const position = {
  type: 'object',
  properties: {
    line: { type: 'integer', minimum: 0, description: 'Zero-based line number.' },
    column: { type: 'integer', minimum: 0, description: 'Zero-based column (UTF-16 code units).' },
  },
  required: ['line', 'column'],
  additionalProperties: false,
} as const;

export const rangeSchema = {
  type: 'object',
  description: 'Zero-based line/column range in the visible editor. end is exclusive.',
  properties: { start: position, end: position },
  required: ['start', 'end'],
  additionalProperties: false,
} as const;

const expectedCodeHash = {
  type: 'string',
  description:
    'The codeHash returned by the most recent strudel_get_code or strudel_get_context call. Rejected with STALE_CODE if the human changed the source since.',
} as const;

const summary = {
  type: 'string',
  maxLength: 140,
  description: 'One-line summary of the change, shown to the human when it becomes a proposal.',
} as const;

const propose = {
  type: 'boolean',
  description: 'Ask the human to review this change even in live mode (creates a proposal instead of editing).',
} as const;

const evaluate = {
  type: 'boolean',
  description: 'Also evaluate the document right after applying (live mode only; same as calling strudel_evaluate).',
} as const;

export const emptySchema = { type: 'object', properties: {}, additionalProperties: false } as const;

export const getCodeSchema = {
  type: 'object',
  properties: {
    startLine: { type: 'integer', minimum: 0, description: 'Optional zero-based first line to return.' },
    endLine: { type: 'integer', minimum: 0, description: 'Optional zero-based last line to return (inclusive).' },
  },
  additionalProperties: false,
} as const;

export const applyEditsSchema = {
  type: 'object',
  properties: {
    expectedCodeHash,
    edits: {
      type: 'array',
      minItems: 1,
      description: 'Non-overlapping replacements, all expressed against the document as it was when read.',
      items: {
        type: 'object',
        properties: {
          range: rangeSchema,
          text: { type: 'string', description: 'Replacement text (empty string deletes the range).' },
        },
        required: ['range', 'text'],
        additionalProperties: false,
      },
    },
    summary,
    propose,
    evaluate,
  },
  required: ['expectedCodeHash', 'edits'],
  additionalProperties: false,
} as const;

export const replaceCodeSchema = {
  type: 'object',
  properties: {
    expectedCodeHash,
    code: { type: 'string', description: 'The complete new Strudel source.' },
    summary,
    propose,
    evaluate,
  },
  required: ['expectedCodeHash', 'code'],
  additionalProperties: false,
} as const;

export const evaluateSchema = {
  type: 'object',
  properties: {
    expectedCodeHash,
    range: { ...rangeSchema, description: 'Solo: evaluate only this range of the visible source (must be a complete pattern expression, e.g. one stack entry). The next full evaluate clears the solo.' },
    proposalId: { type: 'string', description: 'Audition a pending proposal: play its code without changing the document. The human then accepts or discards it.' },
  },
  required: ['expectedCodeHash'],
  additionalProperties: false,
} as const;

export const hashOnlySchema = {
  type: 'object',
  properties: { expectedCodeHash },
  required: ['expectedCodeHash'],
  additionalProperties: false,
} as const;

export const focusRangeSchema = {
  type: 'object',
  properties: {
    expectedCodeHash: { ...expectedCodeHash, description: 'Optional. If supplied, the focus is rejected with STALE_CODE when the source changed.' },
    range: rangeSchema,
  },
  required: ['range'],
  additionalProperties: false,
} as const;

export const recordSchema = {
  type: 'object',
  properties: {
    durationMs: { type: 'integer', minimum: 500, maximum: 30000, description: 'How long to record, in milliseconds (default 4000; 500–30000).' },
    untilStopped: { type: 'boolean', description: 'Keep recording until the human presses Stop in the page (max 5 minutes). The call resolves when they do.' },
    source: { type: 'string', maxLength: 40, description: '"master" (default: everything the human hears) or the id of a voice tagged .analyze("id") to isolate that voice.' },
    includeAudio: { type: 'boolean', description: 'Return the clip itself as base64 webm/opus in audioBase64 (clips up to 20 s).' },
    label: { type: 'string', maxLength: 60, description: 'Short label shown next to the take in the page.' },
  },
  additionalProperties: false,
} as const;

export const loadSamplesSchema = {
  type: 'object',
  properties: {
    sources: {
      description:
        'Either a map of { name: url } (url may be https, or a data:audio/* URL you supply yourself; arrays of urls give numbered variants), or a string: "github:user/repo" or an https URL to a strudel.json sample map.',
      anyOf: [
        { type: 'string' },
        { type: 'object', additionalProperties: { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] } },
      ],
    },
    baseUrl: { type: 'string', description: 'Optional base URL prepended to relative sample paths.' },
  },
  required: ['sources'],
  additionalProperties: false,
} as const;

export const listSoundsSchema = {
  type: 'object',
  properties: {
    query: { type: 'string', maxLength: 60, description: 'Case-insensitive substring filter on sound names (e.g. "909", "hh", "piano").' },
    limit: { type: 'integer', minimum: 1, maximum: 500, description: 'Max results (default 100).' },
  },
  additionalProperties: false,
} as const;

export const snapshotSchema = {
  type: 'object',
  properties: { label: { type: 'string', maxLength: 60, description: 'Name for this version.' } },
  additionalProperties: false,
} as const;

export const setThemeSchema = {
  type: 'object',
  properties: { theme: { type: 'string', maxLength: 40, description: 'Editor theme name (see strudel_get_context.theme and the error payload for the full list).' } },
  required: ['theme'],
  additionalProperties: false,
} as const;
