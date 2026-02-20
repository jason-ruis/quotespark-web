// fetch-quotes.js — ESM, Node 18+
// Parses Obsidian book note files from the vault and extracts quotes into quotes.json.
// Run locally: npm run fetch-quotes
// (This script reads from your local vault; it does not run in GitHub Actions.)

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const config = JSON.parse(readFileSync(join(ROOT, 'src/config/sources.json'), 'utf8'));
const booksPath = config.booksPath;
const today = new Date().toISOString().split('T')[0];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeId(author, text) {
  return createHash('sha256').update(`${author}:${text}`).digest('hex').slice(0, 16);
}

function normalizeText(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function cleanText(raw) {
  return raw
    // Strip block references like ^f4a09c at end of lines
    .replace(/\s*\^[a-z0-9]+$/gm, '')
    // Strip Obsidian highlight markers ==**...**== or ==...==
    .replace(/==\*\*(.+?)\*\*==/g, '$1')
    .replace(/==(.+?)==/g, '$1')
    // Strip bold and italic markdown
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    // Strip wikilinks [[alias|text]] or [[text]]
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    // Strip trailing page numbers: (123) or (17-18)
    .replace(/\s*\(\d+[-–\d]*\)\s*$/, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSimpleYaml(yamlStr) {
  const result = {};
  for (const line of yamlStr.split('\n')) {
    const match = line.match(/^(\w[\w\s]*?):\s*(.+)$/);
    if (match) {
      const key = match[1].trim().toLowerCase();
      const value = match[2].trim().replace(/^['"]|['"]$/g, '');
      result[key] = value;
    }
  }
  return result;
}

function inferAuthorFromFilename(filename) {
  // "Title — Author Name" → author after em-dash
  let m = filename.match(/—\s*(.+)$/);
  if (m) return m[1].trim();
  // "Title by Author Name" or "Title By Author Name"
  m = filename.match(/\s+[Bb]y\s+(.+)$/);
  if (m) return m[1].trim();
  // "Book - Martin Bucer" → last segment after hyphen (two words, both capitalized)
  m = filename.match(/-\s*([A-Z][a-z]+ [A-Z][a-z]+)\s*$/);
  if (m) return m[1].trim();
  return null;
}

function inferTitleFromFilename(filename) {
  // Strip "— Author Name" suffix
  let title = filename.replace(/\s*—\s*.+$/, '');
  // Strip " by Author Name" suffix
  title = title.replace(/\s+[Bb]y\s+.+$/, '');
  // Strip "Quotes from " prefix
  title = title.replace(/^Quotes from\s+/i, '');
  // Strip " - Author Name" at end (two capitalized words)
  title = title.replace(/\s+-\s*[A-Z][a-z]+ [A-Z][a-z]+\s*$/, '');
  return title.trim();
}

function extractAuthorFromBody(body) {
  // Match "* Author: [[Name]]" or "* Author: Name"
  const m = body.match(/^\*\s*[Aa]uthors?:\s*(?:\[\[)?([^\]\n|,]+?)(?:\]\])?\s*$/m);
  if (m) return m[1].trim();
  return null;
}

function isReaderNote(line) {
  const t = line.trim();
  if (!t) return false;
  if (t.startsWith('>')) return true;          // blockquote = reader note
  if (t.startsWith('#')) return true;          // markdown header
  if (t.startsWith('— ')) return true;         // em-dash commentary
  if (/^\*\s*\w+:/.test(t)) return true;       // metadata list (* Author:, * ISBN:)
  if (/^[\w][\w\s]*::/.test(t)) return true;   // Obsidian dataview field
  if (t.startsWith('![[')) return true;         // embedded file
  if (t.startsWith('status::') || t.startsWith('#status')) return true;
  return false;
}

// ─── Main parser ──────────────────────────────────────────────────────────────

function parseBookNote(filepath) {
  const filename = basename(filepath, '.md');
  let content;
  try {
    content = readFileSync(filepath, 'utf8');
  } catch (e) {
    console.error(`  Could not read: ${e.message}`);
    return [];
  }

  // ── Frontmatter
  let body = content;
  let yamlMeta = {};
  if (content.startsWith('---\n')) {
    const endIdx = content.indexOf('\n---\n', 4);
    if (endIdx !== -1) {
      yamlMeta = parseSimpleYaml(content.slice(4, endIdx));
      body = content.slice(endIdx + 5);
    }
  }

  // ── Author resolution
  let author = (
    yamlMeta['author'] ||
    yamlMeta['authors'] ||
    yamlMeta['author name'] ||
    // Some files have capital-A "Author:" in YAML
    Object.entries(yamlMeta).find(([k]) => k.toLowerCase() === 'author')?.[1] || ''
  ).replace(/^\[\[|\]\]$/g, '').trim();

  if (!author) author = extractAuthorFromBody(body) || '';
  if (!author) author = inferAuthorFromFilename(filename) || 'Unknown';

  // ── Book title resolution
  const titleKey = Object.keys(yamlMeta).find(k => k.toLowerCase() === 'title');
  const bookKey = Object.keys(yamlMeta).find(k => k.toLowerCase() === 'book');
  let bookTitle = (
    (titleKey ? yamlMeta[titleKey] : '') ||
    (bookKey ? yamlMeta[bookKey] : '') || ''
  ).trim();
  if (!bookTitle) bookTitle = inferTitleFromFilename(filename);

  // ── Topics from YAML category
  const catKey = Object.keys(yamlMeta).find(k => k.toLowerCase() === 'category' || k.toLowerCase() === 'categories');
  const topics = catKey
    ? [yamlMeta[catKey].split(/[,&]/)[0].trim()].filter(Boolean)
    : [];

  // ── Split into chunks
  const hasSections = /\n---\n/.test(body);
  const chunks = hasSections
    ? body.split(/\n---\n/)
    : body.split(/\n\n+/);

  const quotes = [];
  const seen = new Set();

  for (const chunk of chunks) {
    const lines = chunk.split('\n');

    // Separate quote lines from reader notes
    const quoteLines = lines.filter(l => !isReaderNote(l) && l.trim() !== '');

    if (quoteLines.length === 0) continue;

    let rawText = quoteLines.join(' ');

    // ── Inline attribution: (J Gresham Machen, Christianity & Liberalism, 59)
    let resolvedAuthor = author;
    let resolvedSource = bookTitle;

    const attrMatch = rawText.match(/\(([A-Z][a-z]+(?: [A-Z][a-z]+)+),\s*([^,)]+),?\s*[\d-]+\)\s*$/);
    if (attrMatch) {
      resolvedAuthor = attrMatch[1].trim();
      resolvedSource = attrMatch[2].trim();
      rawText = rawText.slice(0, rawText.lastIndexOf('(')).trim();
    }

    const cleaned = cleanText(rawText);

    // ── Length filter
    if (cleaned.length < 40 || cleaned.length > 1000) continue;

    // ── Skip all-caps section headings (e.g. "PRINCIPLE #1: DO FEWER THINGS")
    const lettersOnly = cleaned.replace(/[^A-Za-z]/g, '');
    if (lettersOnly.length > 4 && cleaned === cleaned.toUpperCase()) continue;

    // ── Skip lone page header lines (chapter numbers, roman numerals, etc.)
    if (/^(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE)$/i.test(cleaned.trim())) continue;

    // ── Dedup within this file
    const norm = normalizeText(cleaned);
    if (seen.has(norm)) continue;
    seen.add(norm);

    quotes.push({ text: cleaned, author: resolvedAuthor, source: resolvedSource, topics });
  }

  return quotes;
}

// ─── Run ──────────────────────────────────────────────────────────────────────

console.log(`Reading book notes from:\n  ${booksPath}\n`);

const files = readdirSync(booksPath)
  .filter(f => f.endsWith('.md'))
  .sort();

const allQuotes = [];
const globalSeen = new Set();
let fileCount = 0;

for (const filename of files) {
  const filepath = join(booksPath, filename);
  const quotes = parseBookNote(filepath);
  let added = 0;

  for (const q of quotes) {
    const norm = normalizeText(q.text);
    if (globalSeen.has(norm)) continue;
    globalSeen.add(norm);

    allQuotes.push({
      id: makeId(q.author, q.text),
      text: q.text,
      author: q.author,
      source: q.source,
      topics: q.topics,
      addedAt: today
    });
    added++;
  }

  if (added > 0) {
    console.log(`  ${basename(filename, '.md')}: ${added} quotes`);
    fileCount++;
  }
}

const quotesPath = join(ROOT, 'src/data/quotes.json');
writeFileSync(quotesPath, JSON.stringify(allQuotes, null, 2));

console.log(`\nDone. Extracted ${allQuotes.length} quotes from ${fileCount} books.`);
