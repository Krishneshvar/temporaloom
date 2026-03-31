import * as cheerio from 'cheerio';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

export async function buildGraphFromWeb(startUrl, maxDepth) {
  const urlMap = new Map();
  const edges = [];
  let nextId = 0;

  const getId = (url) => {
    if (!urlMap.has(url)) {
      urlMap.set(url, nextId++);
    }
    return urlMap.get(url);
  };

  const queue = [{ url: startUrl, depth: 0 }];
  const visited = new Set();
  const inQueue = new Set();
  inQueue.add(startUrl);

  while (queue.length > 0) {
    const { url, depth } = queue.shift();

    if (visited.has(url)) continue;
    visited.add(url);

    let html;
    try {
      const resp = await axios.get(url, { 
        timeout: 5000, 
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Temporaloom-Bot/1.0'
        }
      });
      // Skip non-HTML responses implicitly
      if (typeof resp.data === 'string') {
        html = resp.data;
      } else {
        continue;
      }
    } catch (e) {
      continue;
    }

    const sourceId = getId(url);

    if (depth < maxDepth && html) {
      const $ = cheerio.load(html);
      $('a').each((i, el) => {
        let href = $(el).attr('href');
        if (!href) return;

        try {
          const parsedUrl = new URL(href, url);
          if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return;
          
          parsedUrl.hash = ''; // Remove fragments to prevent duplication of same physical page
          const cleanHref = parsedUrl.href;

          const targetId = getId(cleanHref);
          
          if (sourceId !== targetId) {
             edges.push([sourceId, targetId]);
          }

          if (!visited.has(cleanHref) && !inQueue.has(cleanHref)) {
            inQueue.add(cleanHref);
            queue.push({ url: cleanHref, depth: depth + 1 });
          }
        } catch (e) {
          // Format error or parsing error -> ignore connection
        }
      });
    }
  }

  const numNodes = nextId;
  const uniqueEdges = new Set();

  for (const [u, v] of edges) {
    uniqueEdges.add(`${u} ${v}`);
  }

  const actualNumEdges = uniqueEdges.size;
  
  if (numNodes === 0) {
     throw new Error("Unable to parse any nodes or standard HTML from the provided root URL.");
  }

  const safeDomain = new URL(startUrl).hostname.replace(/[^a-z0-9]/gi, '_');
  const filename = `website_${safeDomain}_d${maxDepth}.txt`;
  const filepath = path.join(process.cwd(), 'datasets', filename);

  const header = `# nodes edges\n${numNodes} ${actualNumEdges}\n`;
  const content = header + Array.from(uniqueEdges).join('\n') + '\n';

  fs.writeFileSync(filepath, content);

  return {
    filename,
    numNodes,
    numEdges: actualNumEdges,
    message: `Scraped ${numNodes} interconnected domains/pages. Map generated as ${filename}.`
  };
}
