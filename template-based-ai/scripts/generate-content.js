#!/usr/bin/env node
/**
 * Generate content from template for a given keyword
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { generateAIContent } from '../lib/ai-content.js';
import {
  replaceContentInHTML,
  replaceDatesInHTML,
  removeNavigationElements,
  removeImagePreloadTags,
  convertToRelativePaths,
  removeNextJsScripts,
  beautifyHTML,
  replaceRelatedVideos
} from '../lib/html-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const TEMPLATE_FILE = path.join(__dirname, '../templates/base-template.html');
const OUTPUT_DIR = path.join(__dirname, '../output');

async function generateContent(keyword) {
  console.log('🚀 Template-Based Content Generation');
  console.log('=====================================');
  console.log(`Keyword: "${keyword}"`);
  console.log('');

  // Check if template exists
  if (!fs.existsSync(TEMPLATE_FILE)) {
    console.error('❌ Template not found!');
    console.error('   Run: npm run fetch-template');
    process.exit(1);
  }

  // Load template
  console.log('📄 Loading template...');
  const startLoad = Date.now();
  const template = fs.readFileSync(TEMPLATE_FILE, 'utf8');
  const loadTime = Date.now() - startLoad;
  console.log(`✅ Template loaded (${loadTime}ms)`);
  console.log('');

  // Generate AI content
  console.log('🤖 Generating AI content...');
  const startAI = Date.now();
  const aiContent = await generateAIContent(keyword, process.env.OPENAI_API_KEY);
  const aiTime = Date.now() - startAI;
  console.log(`✅ AI content generated (${aiTime}ms)`);
  console.log('');
  console.log('   Title:', aiContent.title);
  console.log('   Meta:', aiContent.description.meta.substring(0, 60) + '...');
  console.log('');

  // Process template (same as Next.js SSR)
  console.log('🔄 Processing template...');
  // Use keyword-based canonical URL for unique URLs per keyword
  const keywordSlug = keyword.replace(/\s+/g, '-').toLowerCase();
  const canonicalUrl = `${process.env.ORIGINAL_SITE_URL}/${keywordSlug}`;
  const ogUrl = canonicalUrl;

  let finalHTML = template;
  finalHTML = replaceContentInHTML(finalHTML, aiContent, canonicalUrl, ogUrl);
  finalHTML = replaceDatesInHTML(finalHTML);
  finalHTML = convertToRelativePaths(finalHTML);
  finalHTML = removeNextJsScripts(finalHTML);
  finalHTML = removeImagePreloadTags(finalHTML);
  finalHTML = removeNavigationElements(finalHTML);
  finalHTML = replaceRelatedVideos(finalHTML, aiContent);
  finalHTML = beautifyHTML(finalHTML);
  console.log('');

  // Save output
  const outputFile = path.join(OUTPUT_DIR, `${keyword.replace(/\s+/g, '-')}.html`);
  fs.writeFileSync(outputFile, finalHTML, 'utf8');

  const totalTime = Date.now() - startLoad;
  console.log('✅ Content generation complete!');
  console.log('');
  console.log('📊 Performance:');
  console.log(`   Template load: ${loadTime}ms`);
  console.log(`   AI generation: ${aiTime}ms`);
  console.log(`   Total time: ${totalTime}ms (~${(totalTime / 1000).toFixed(1)}s)`);
  console.log('');
  console.log('📄 Output:');
  console.log(`   File: ${outputFile}`);
  console.log(`   Size: ${finalHTML.length.toLocaleString()} bytes`);
  console.log('');
  console.log('🎯 Comparison:');
  console.log(`   Template-based: ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`   With scraping: ~4-6s`);
  console.log(`   ⚡ ${(((4.5 - totalTime / 1000) / 4.5) * 100).toFixed(0)}% faster!`);
}

// Get keyword from command line
const keyword = process.argv[2];

if (!keyword) {
  console.error('❌ Keyword required!');
  console.error('');
  console.error('Usage:');
  console.error('  npm run generate -- "your keyword here"');
  console.error('');
  console.error('Example:');
  console.error('  npm run generate -- "dating trends 2026"');
  process.exit(1);
}

generateContent(keyword).catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
