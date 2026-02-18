import type { Quote } from '../types/Quote';
import rawQuotesData from '../data/quotes.json';

export function loadQuotes(): Quote[] {
  return rawQuotesData as unknown as Quote[];
}

export function shuffleQuotes(quotes: Quote[]): Quote[] {
  const shuffled = [...quotes];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
