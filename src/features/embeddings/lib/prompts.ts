/**
 * Some embedding models were trained to be told what kind of text they're
 * given: a search, or a passage to be found. They match better when told.
 */
export interface Prompts {
  query: string
  passage: string
}

const NONE: Prompts = { query: '', passage: '' }
const RETRIEVAL_INSTRUCTION =
  'Represent this sentence for searching relevant passages: '

/** Model name patterns and their prompts, from each model's own card. */
const RULES: ReadonlyArray<[RegExp, Prompts]> = [
  [/nomic-embed/i, { query: 'search_query: ', passage: 'search_document: ' }],
  [
    /(?:^|[^a-z0-9])e5(?:[^a-z0-9]|$)/i,
    { query: 'query: ', passage: 'passage: ' },
  ],
  [
    /snowflake-arctic-embed2|arctic-embed-[sml]-v2/i,
    { query: 'query: ', passage: '' },
  ],
  [
    /mxbai-embed-large|bge-[a-z]+-en|snowflake-arctic-embed|arctic-embed-/i,
    { query: RETRIEVAL_INSTRUCTION, passage: '' },
  ],
]

/** What to put before searches and passages for a model (usually nothing). */
export function promptsFor(model: string): Prompts {
  return RULES.find(([pattern]) => pattern.test(model))?.[1] ?? NONE
}
