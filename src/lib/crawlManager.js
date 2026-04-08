// Global manager for active crawls to allow cross-request communication
class CrawlManager {
  constructor() {
    this.activeCrawl = null;
  }

  startCrawl(id, controller) {
    this.activeCrawl = {
      id,
      controller,
      settings: {
        concurrency: 12
      }
    };
    return this.activeCrawl;
  }

  updateSettings(settings) {
    if (this.activeCrawl) {
      this.activeCrawl.settings = { ...this.activeCrawl.settings, ...settings };
      return true;
    }
    return false;
  }

  getSettings() {
    return this.activeCrawl?.settings || { concurrency: 12 };
  }

  stopCrawl() {
    if (this.activeCrawl) {
      this.activeCrawl.controller.abort();
      this.activeCrawl = null;
    }
  }
}

// In Next.js dev mode, the global object is cleared on reload, 
// so we use a persistent reference if available
const globalCrawlManager = global.crawlManager || new CrawlManager();
if (process.env.NODE_ENV !== 'production') global.crawlManager = globalCrawlManager;

export default globalCrawlManager;
