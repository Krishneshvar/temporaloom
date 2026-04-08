import fs from 'fs';
import path from 'path';

const HISTORY_FILE = path.join(process.cwd(), 'run_history.json');
const SCRAPE_HISTORY_FILE = path.join(process.cwd(), 'scrape_history.json');
const SCRAPE_DIR = path.join(process.cwd(), 'data', 'scrapes');
const MAX_ENTRIES = 50;

if (!fs.existsSync(SCRAPE_DIR)) fs.mkdirSync(SCRAPE_DIR, { recursive: true });

export function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); }
  catch { return []; }
}

export function saveRun(entry) {
  const history = loadHistory();
  const record = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  history.unshift(record);
  if (history.length > MAX_ENTRIES) history.splice(MAX_ENTRIES);
  try { fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2)); }
  catch (_) {}
  return record;
}

export function clearHistory() {
  try { fs.writeFileSync(HISTORY_FILE, '[]'); } catch (_) {}
}

// ── Scrape History ──

export function loadScrapeHistory() {
  if (!fs.existsSync(SCRAPE_HISTORY_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(SCRAPE_HISTORY_FILE, 'utf8')); }
  catch { return []; }
}

export function saveScrapeSession(metadata, events) {
  const history = loadScrapeHistory();
  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  
  const record = {
    id: sessionId,
    timestamp: new Date().toISOString(),
    ...metadata,
    numNodes: events.findLast(e => e.nodes)?.nodes || 0,
    numEdges: events.findLast(e => e.edges)?.edges || 0,
  };

  // Save the full event stream to a dedicated file
  const sessionFile = path.join(SCRAPE_DIR, `${sessionId}.json`);
  try {
    fs.writeFileSync(sessionFile, JSON.stringify(events, null, 2));
  } catch (e) {
    console.error('Failed to save scrape session detailed data', e);
  }

  history.unshift(record);
  if (history.length > MAX_ENTRIES) {
    const deleted = history.splice(MAX_ENTRIES);
    deleted.forEach(d => {
      try { fs.unlinkSync(path.join(SCRAPE_DIR, `${d.id}.json`)); } catch (_) {}
    });
  }

  try { fs.writeFileSync(SCRAPE_HISTORY_FILE, JSON.stringify(history, null, 2)); }
  catch (_) {}
  return record;
}

export function getScrapeSession(id) {
  const sessionFile = path.join(SCRAPE_DIR, `${id}.json`);
  if (!fs.existsSync(sessionFile)) return null;
  try { return JSON.parse(fs.readFileSync(sessionFile, 'utf8')); }
  catch { return null; }
}
