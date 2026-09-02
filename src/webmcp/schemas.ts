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
  description: 'The codeHash returned by the most recent strudel_get_code or strudel_get_context call. Rejected with STALE_CODE if the human changed the source since.',
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
  },
  required: ['expectedCodeHash', 'edits'],
  additionalProperties: false,
} as const;

export const replaceCodeSchema = {
  type: 'object',
  properties: {
    expectedCodeHash,
    code: { type: 'string', description: 'The complete new Strudel source.' },
  },
  required: ['expectedCodeHash', 'code'],
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
