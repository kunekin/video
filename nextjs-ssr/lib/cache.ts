// lib/cache.ts
import { HeadAssets } from './html-utils';

interface CacheEntry {
  fullHTML: string; // Full HTML document including <html>, <head>, <body>
  aiContent: any;
  headAssets: HeadAssets;
  timestamp: number;
}

const contentCache = new Map<string, CacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export const cache = {
  get: (keyword: string): CacheEntry | undefined => {
    const entry = contentCache.get(keyword);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
      console.log(`✅ Cache HIT for: ${keyword}`);
      return entry;
    }
    if (entry) {
      console.log(`⚠️ Cache EXPIRED for: ${keyword}`);
      contentCache.delete(keyword);
    }
    console.log(`🔍 Cache MISS - will scrape and cache`);
    return undefined;
  },
  set: (keyword: string, fullHTML: string, aiContent: any, headAssets: HeadAssets) => {
    contentCache.set(keyword, { 
      fullHTML, 
      aiContent, 
      headAssets, 
      timestamp: Date.now() 
    });
    console.log(`💾 Cached full HTML for: ${keyword} (size: ${fullHTML.length} bytes)`);
  },
  clear: (keyword?: string) => {
    if (keyword) {
      contentCache.delete(keyword);
      console.log(`🗑️ Cache cleared for: ${keyword}`);
    } else {
      contentCache.clear();
      console.log(`🗑️ All cache cleared`);
    }
  },
  stats: () => {
    return {
      size: contentCache.size,
      keys: Array.from(contentCache.keys()),
    };
  },
};
