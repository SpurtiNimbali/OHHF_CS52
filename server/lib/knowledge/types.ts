export type KnowledgeChunk = {
  id: string
  text: string
  title: string
  sourceUrl: string
  originalFile: string
}

export type KnowledgeItem = KnowledgeChunk & {
  embedding: number[]
}

export type KnowledgeIndexFile = {
  embeddingModel: string
  version: number
  builtAt: string
  itemCount: number
  items: KnowledgeItem[]
}

export type RetrievedChunk = KnowledgeChunk & {
  score: number
}
