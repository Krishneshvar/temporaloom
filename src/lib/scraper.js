import * as cheerio from 'cheerio';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

/**
 * Robust Web Crawler for Temporaloom
 * - Concurrency: Multiple workers crawling simultaneously
 * - Domain Locking: Only crawls URLs within the same hostname
 * - Normalization: Cleans URLs to prevent duplicates
 * - Filtering: Ignores non-HTML assets (images, PDFs, etc.)
 */

// Common non-HTML extensions to skip
const IGNORED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico',
  '.mp4', '.mkv', '.avi', '.mov', '.mp3', '.wav',
  '.pdf', '.zip', '.tar', '.gz', '.xlsx', '.docx', '.pptx',
  '.css', '.js', '.map', '.json', '.xml'
]);

export async function buildGraphFromWeb(startUrl, maxDepth, onUpdate = null, signal = null) {
  const urlMap = new Map();
  const edges = new Set();
  let nextId = 0;
  
  const startTime = Date.now();
  const CRAWL_TIMEOUT_MS = 20000; 
  const CONCURRENCY_LIMIT = 12; // Increased for high performance

  const getId = (url) => {
    if (!urlMap.has(url)) {
      urlMap.set(url, nextId++);
    }
    return urlMap.get(url);
  };

  const startParsed = new URL(startUrl);
  const startHostname = startParsed.hostname;
  const normalizedStart = normalizeUrl(startUrl);

  const queue = [{ url: normalizedStart, depth: 0 }];
  const visited = new Set();
  const processing = new Set([normalizedStart]);
  
  let activeRequests = 0;
  let taskAvailableResolver = null;

  const notifyTaskAvailable = () => {
    if (taskAvailableResolver) {
      taskAvailableResolver();
      taskAvailableResolver = null;
    }
  };

  const waitForTask = () => new Promise(resolve => {
    taskAvailableResolver = resolve;
  });

  async function processUrl({ url, depth }) {
    if (signal?.aborted) return;
    if (Date.now() - startTime >= CRAWL_TIMEOUT_MS) return;
    if (visited.has(url)) return;
    
    visited.add(url);
    const sourceId = getId(url);

    // Don't fetch if we've reached max depth (edges are added during the previous depth's scan)
    if (depth >= maxDepth) return;

    if (onUpdate) onUpdate({ 
      type: 'crawling', 
      url, 
      depth, 
      nodes: nextId, 
      edges: edges.size,
      active: activeRequests 
    });

    try {
      const resp = await axios.get(url, { 
        timeout: 8000,
        signal: signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36 Temporaloom-Bot/1.4'
        },
        validateStatus: (status) => status === 200
      });

      const contentType = resp.headers['content-type'];
      if (!contentType || !contentType.includes('text/html')) {
        if (onUpdate) onUpdate({ type: 'skipped', url, reason: 'non-html' });
        return;
      }

      const html = resp.data;
      if (typeof html !== 'string') return;

      const $ = cheerio.load(html);
      const links = $('a').map((i, el) => $(el).attr('href')).get();

      // Parallelize link processing (normalization and filtering)
      const uniqueLinks = Array.from(new Set(links));
      let foundCount = 0;

      for (const href of uniqueLinks) {
        if (signal?.aborted) break;
        if (!href) continue;

        try {
          const parsedUrl = new URL(href, url);
          if (parsedUrl.hostname !== startHostname) continue;
          if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') continue;
          
          const ext = path.extname(parsedUrl.pathname).toLowerCase();
          if (IGNORED_EXTENSIONS.has(ext)) continue;

          const cleanHref = normalizeUrl(parsedUrl.href);
          const targetId = getId(cleanHref);
          
          if (sourceId !== targetId) {
            edges.add(`${sourceId} ${targetId}`);
            foundCount++;
          }

          if (!visited.has(cleanHref) && !processing.has(cleanHref)) {
             processing.add(cleanHref);
             queue.push({ url: cleanHref, depth: depth + 1 });
             notifyTaskAvailable(); // Wake up any waiting workers
          }
        } catch (e) {}
      }
      
      if (onUpdate) onUpdate({ type: 'finished', url, found: foundCount, nodes: nextId, edges: edges.size, active: activeRequests });

    } catch (error) {
      if (axios.isCancel(error)) return;
      if (onUpdate) onUpdate({ type: 'error', url, message: error.message });
    }
  }

  const workers = [];
  for (let i = 0; i < CONCURRENCY_LIMIT; i++) {
    workers.push((async () => {
      while (true) {
        if (signal?.aborted) break;
        if (Date.now() - startTime >= CRAWL_TIMEOUT_MS) break;

        const task = queue.shift();
        
        if (!task) {
          // If no tasks, wait if others are still working
          if (activeRequests > 0) {
            await Promise.race([
              waitForTask(),
              new Promise(r => setTimeout(r, 100)) // Safety timeout
            ]);
            continue;
          } else {
            // No tasks and no active requests -> we are completely done
            break;
          }
        }

        activeRequests++;
        try {
          await processUrl(task);
        } finally {
          activeRequests--;
          notifyTaskAvailable(); // Notify that a slot is free and we might be finished
        }
      }
    })());
  }

  await Promise.all(workers);

  if (signal?.aborted) {
    if (onUpdate) onUpdate({ type: 'aborted' });
    return { aborted: true };
  }


  const numNodes = nextId;
  const numEdges = edges.size;
  
  if (numNodes === 0) {
     throw new Error("Unable to parse any nodes from the provided root URL. Ensure it is a valid HTML page.");
  }

  // File Generation
  const safeDomain = startHostname.replace(/[^a-z0-9]/gi, '_');
  const filename = `website_${safeDomain}_d${maxDepth}.txt`;
  
  // Ensure datasets directory exists
  const datasetsPath = path.join(process.cwd(), 'datasets');
  if (!fs.existsSync(datasetsPath)) fs.mkdirSync(datasetsPath, { recursive: true });
  
  const filepath = path.join(datasetsPath, filename);

  const header = `# nodes edges\n${numNodes} ${numEdges}\n`;
  const content = header + Array.from(edges).join('\n') + '\n';

  fs.writeFileSync(filepath, content);

  const finalResult = {
    filename,
    numNodes,
    numEdges,
    message: `Scraped ${numNodes} nodes and ${numEdges} edges. Timeout: ${Date.now() - startTime < CRAWL_TIMEOUT_MS ? 'Success' : 'Partial (reached 20s limit)'}. Dataset generated as ${filename}.`
  };

  if (onUpdate) onUpdate({ type: 'complete', data: finalResult });

  return finalResult;
}


/**
 * Normalizes a URL: removes fragments, trailing slashes, and ensures consistent format.
 */
function normalizeUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    url.hash = ''; // Remove #fragment
    
    // Remove trailing slash from pathname if present (unless it's just '/')
    if (url.pathname.endsWith('/') && url.pathname.length > 1) {
      url.pathname = url.pathname.slice(0, -1);
    }
    
    return url.href;
  } catch (e) {
    return urlStr;
  }
}

