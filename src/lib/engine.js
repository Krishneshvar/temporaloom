import path from 'path';
import fs from 'fs';

export const datasetsDir = path.join(process.cwd(), 'datasets');
export const resultsDir = path.join(process.cwd(), 'results');
export const engineDir = path.join(process.cwd(), 'engine');

export function cleanResultsDir() {
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  } else {
    const files = fs.readdirSync(resultsDir);
    for (const file of files) {
      if (file.startsWith('iteration_') && file.endsWith('.json')) {
        fs.unlinkSync(path.join(resultsDir, file));
      }
    }
  }
}
