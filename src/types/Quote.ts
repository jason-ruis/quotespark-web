export interface Quote {
  id: string;       // first 16 chars of sha256(author:text)
  text: string;
  author: string;
  source?: string;  // book/speech title if available
  topics: string[]; // from sources.json author config
  addedAt: string;  // ISO date (YYYY-MM-DD)
}
