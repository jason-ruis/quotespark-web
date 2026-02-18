// fetch-quotes.js — ESM, Node 18+
// Fetches quotes from WikiQuote (for specific authors) and Quotable.io (by tag),
// deduplicates against existing quotes.json, and appends new entries.

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { parse } from 'node-html-parser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Load config
const config = JSON.parse(
  readFileSync(join(ROOT, 'src/config/sources.json'), 'utf8')
);

// Load existing quotes (grows over time)
const quotesPath = join(ROOT, 'src/data/quotes.json');
let existingQuotes = [];
if (existsSync(quotesPath)) {
  existingQuotes = JSON.parse(readFileSync(quotesPath, 'utf8'));
}

// Build dedup set from normalized text
const existingNormalized = new Set(existingQuotes.map(q => normalizeText(q.text)));

function normalizeText(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function makeId(author, text) {
  return createHash('sha256').update(`${author}:${text}`).digest('hex').slice(0, 16);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const newQuotes = [];
const today = new Date().toISOString().split('T')[0];

// ─── WikiQuote ───────────────────────────────────────────────────────────────

console.log('\nFetching from WikiQuote...');

for (const authorConfig of config.authors) {
  const { name, topics } = authorConfig;
  const pageName = name.replace(/ /g, '_');
  const url = `https://en.wikiquote.org/w/api.php?action=parse&page=${encodeURIComponent(pageName)}&prop=text&format=json&origin=*`;

  try {
    console.log(`  ${name}`);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'QuoteSpark/1.0 (quote-fetcher; contact via GitHub)' }
    });

    if (!response.ok) {
      console.log(`    Skipped (HTTP ${response.status})`);
      await sleep(500);
      continue;
    }

    const data = await response.json();

    if (data.error) {
      console.log(`    Skipped (${data.error.code}: not found or no page)`);
      await sleep(500);
      continue;
    }

    const html = data.parse?.text?.['*'];
    if (!html) {
      console.log(`    No HTML content`);
      await sleep(500);
      continue;
    }

    const root = parse(html);
    const lis = root.querySelectorAll('ul > li');
    let count = 0;

    for (const li of lis) {
      // Strip nested ul/ol blocks (attribution lines like "As quoted in...")
      const cleaned = li.innerHTML
        .replace(/<ul[\s\S]*?<\/ul>/gi, '')
        .replace(/<ol[\s\S]*?<\/ol>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        // Decode common HTML entities
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');

      if (cleaned.length < 40 || cleaned.length > 600) continue;

      // Skip attribution/navigation lines
      if (/^(as quoted|source:|from |see also|references|notes|edit|chapter|book |part )/i.test(cleaned)) continue;

      // Skip lines that are mostly punctuation or look like section headers
      if (/^[\W\d]+$/.test(cleaned)) continue;

      const normalized = normalizeText(cleaned);
      if (existingNormalized.has(normalized)) continue;

      newQuotes.push({
        id: makeId(name, cleaned),
        text: cleaned,
        author: name,
        topics,
        addedAt: today
      });
      existingNormalized.add(normalized);
      count++;
    }

    console.log(`    +${count} quotes`);
  } catch (err) {
    console.error(`    Error: ${err.message}`);
  }

  await sleep(500);
}

// ─── Quotable.io ─────────────────────────────────────────────────────────────

console.log('\nFetching from Quotable.io...');

for (const tag of config.quotableTags) {
  const url = `https://api.quotable.io/quotes?tags=${encodeURIComponent(tag)}&limit=30`;

  try {
    console.log(`  tag: ${tag}`);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'QuoteSpark/1.0 (quote-fetcher; contact via GitHub)' }
    });

    if (!response.ok) {
      console.log(`    Skipped (HTTP ${response.status})`);
      continue;
    }

    const data = await response.json();
    const results = data.results ?? [];
    let count = 0;

    for (const item of results) {
      const text = item.content?.trim();
      const author = item.author?.trim();
      if (!text || !author) continue;
      if (text.length < 40 || text.length > 600) continue;

      const normalized = normalizeText(text);
      if (existingNormalized.has(normalized)) continue;

      newQuotes.push({
        id: makeId(author, text),
        text,
        author,
        topics: [tag],
        addedAt: today
      });
      existingNormalized.add(normalized);
      count++;
    }

    console.log(`    +${count} quotes`);
  } catch (err) {
    console.error(`    Error: ${err.message}`);
  }

  await sleep(200);
}

// ─── Write updated database ───────────────────────────────────────────────────

const allQuotes = [...existingQuotes, ...newQuotes];
writeFileSync(quotesPath, JSON.stringify(allQuotes, null, 2));

console.log(`\nDone. Added ${newQuotes.length} new quotes. Total database: ${allQuotes.length} quotes.`);
