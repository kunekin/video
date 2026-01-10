#!/usr/bin/env node
/**
 * Sitemap Utility
 * Handles loading, parsing, merging, and saving sitemap.xml
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const OUTPUT_DIR = path.join(__dirname, '../output');
const SITEMAP_FILE = path.join(OUTPUT_DIR, 'sitemap.xml');
const SITEMAP_BASE_URL = process.env.SITEMAP_BASE_URL || process.env.S3_BUCKET_URL || 'https://example.com';

/**
 * Load existing sitemap.xml and parse URLs
 * @returns {Promise<Array<{loc: string, lastmod: string}>>} - Array of URL entries
 */
export async function loadSitemap() {
  if (!fs.existsSync(SITEMAP_FILE)) {
    return []; // Return empty array if sitemap doesn't exist
  }

  try {
    let xmlContent = fs.readFileSync(SITEMAP_FILE, 'utf8');
    
    // Clean up any invalid tags that might exist (like script tags)
    // Remove script tags completely to ensure clean sitemap
    xmlContent = xmlContent.replace(/<script[^>]*>.*?<\/script>/gis, '');
    xmlContent = xmlContent.replace(/<script[^>]*\/>/gi, '');
    
    // Simple XML parser for sitemap (using regex)
    // More robust than full XML parser for this use case
    const urlPattern = /<url>\s*<loc>(.*?)<\/loc>\s*(?:<lastmod>(.*?)<\/lastmod>)?\s*<\/url>/gs;
    const entries = [];
    let match;

    while ((match = urlPattern.exec(xmlContent)) !== null) {
      entries.push({
        loc: match[1].trim(),
        lastmod: match[2] ? match[2].trim() : new Date().toISOString().split('T')[0],
      });
    }

    return entries;
  } catch (error) {
    console.warn(`⚠️  Warning: Could not parse existing sitemap.xml: ${error.message}`);
    return []; // Return empty array on error
  }
}

/**
 * Create sitemap XML content from URL entries
 * @param {Array<{loc: string, lastmod: string}>} entries - Array of URL entries
 * @returns {string} - XML content
 */
export function generateSitemapXML(entries) {
  const today = new Date().toISOString().split('T')[0];
  
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  entries.forEach(entry => {
    xml += '  <url>\n';
    xml += `    <loc>${escapeXML(entry.loc)}</loc>\n`;
    xml += `    <lastmod>${entry.lastmod || today}</lastmod>\n`;
    xml += '  </url>\n';
  });
  
  xml += '</urlset>\n';
  
  return xml;
}

/**
 * Escape XML special characters
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeXML(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Merge new entries with existing sitemap (incremental update)
 * @param {Array<{loc: string, lastmod: string}>} existingEntries - Existing URL entries
 * @param {Array<{loc: string, lastmod: string}>} newEntries - New URL entries to add
 * @returns {Array<{loc: string, lastmod: string}>} - Merged entries (no duplicates)
 */
export function mergeSitemapEntries(existingEntries, newEntries) {
  // Create a Map to track existing URLs (for deduplication)
  const urlMap = new Map();
  
  // Add existing entries first
  existingEntries.forEach(entry => {
    urlMap.set(entry.loc, entry);
  });
  
  // Add new entries (will overwrite if duplicate, keeping the new one)
  newEntries.forEach(entry => {
    urlMap.set(entry.loc, entry);
  });
  
  // Convert Map back to Array and sort by URL
  return Array.from(urlMap.values()).sort((a, b) => a.loc.localeCompare(b.loc));
}

/**
 * Save sitemap to file
 * @param {Array<{loc: string, lastmod: string}>} entries - URL entries
 * @returns {Promise<void>}
 */
export async function saveSitemap(entries) {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Generate XML
  const xmlContent = generateSitemapXML(entries);
  
  // Write to file
  fs.writeFileSync(SITEMAP_FILE, xmlContent, 'utf8');
}

/**
 * Add URLs to sitemap (incremental update)
 * This function loads existing sitemap, merges with new entries, and saves
 * @param {Array<{loc: string, lastmod?: string}>} newUrls - Array of URLs to add
 * @returns {Promise<number>} - Number of total URLs in sitemap after update
 */
export async function addToSitemap(newUrls) {
  // Load existing sitemap
  const existingEntries = await loadSitemap();
  
  // Prepare new entries with today's date if lastmod not provided
  const today = new Date().toISOString().split('T')[0];
  const newEntries = newUrls.map(url => ({
    loc: typeof url === 'string' ? url : url.loc,
    lastmod: typeof url === 'object' && url.lastmod ? url.lastmod : today,
  }));
  
  // Merge entries
  const mergedEntries = mergeSitemapEntries(existingEntries, newEntries);
  
  // Save sitemap
  await saveSitemap(mergedEntries);
  
  return mergedEntries.length;
}

/**
 * Get sitemap file path
 * @returns {string} - Path to sitemap.xml file
 */
export function getSitemapPath() {
  return SITEMAP_FILE;
}

/**
 * Build full URL for sitemap entry
 * @param {string} filename - HTML filename
 * @returns {string} - Full URL
 */
export function buildSitemapURL(filename) {
  // Remove leading slash if present
  const cleanBaseUrl = SITEMAP_BASE_URL.replace(/\/$/, '');
  const cleanFilename = filename.startsWith('/') ? filename : `/${filename}`;
  return `${cleanBaseUrl}${cleanFilename}`;
}
