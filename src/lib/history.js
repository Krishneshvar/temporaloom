import fs from 'fs';
import path from 'path';

const HISTORY_FILE = path.join(process.cwd(), 'run_history.json');
const MAX_ENTRIES = 50;

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
