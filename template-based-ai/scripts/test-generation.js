#!/usr/bin/env node
/**
 * Test content generation with multiple keywords
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
  beautifyHTML
} from '../lib/html-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const TEMPLATE_FILE = path.join(__dirname, '../templates/base-template.html');
const OUTPUT_DIR = path.join(__dirname, '../output');

const TEST_KEYWORDS = [
  'dating tips for men',
  'best packaging trends 2026',
  'healthy eating habits'
];

async function testGeneration() {
  console.log('🧪 Testing Template-Based Generation');
  console.log('=====================================');
  console.log('');

  // Check template
  if (!fs.existsSync(TEMPLATE_FILE)) {
    console.error('❌ Template not found!');
    console.error('   Run: npm run fetch-template');
    process.exit(1);
  }

  // Load template once
  console.log('📄 Loading template...');
  const template = fs.readFileSync(TEMPLATE_FILE, 'utf8');
  console.log('✅ Template loaded');
  console.log('');

  const results = [];

  for (const keyword of TEST_KEYWORDS) {
    console.log(`🔄 Processing: "${keyword}"`);
    const start = Date.now();

    try {
      // Generate AI content
      const aiContent = await generateAIContent(keyword, process.env.OPENAI_API_KEY);
      
      // Process template (same as Next.js SSR)
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
      finalHTML = beautifyHTML(finalHTML);

      // Save
      const outputFile = path.join(OUTPUT_DIR, `test-${keyword.replace(/\s+/g, '-')}.html`);
      fs.writeFileSync(outputFile, finalHTML, 'utf8');

      const time = Date.now() - start;
      results.push({
        keyword,
        time,
        title: aiContent.title,
        file: path.basename(outputFile),
        success: true
      });

      console.log(`✅ Complete (${(time / 1000).toFixed(1)}s)`);
      console.log(`   Title: ${aiContent.title}`);
      console.log('');
    } catch (error) {
      results.push({
        keyword,
        success: false,
        error: error.message
      });
      console.log(`❌ Failed: ${error.message}`);
      console.log('');
    }
  }

  // Summary
  console.log('═══════════════════════════════════════');
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log('');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);
  console.log('');

  if (successful.length > 0) {
    const avgTime = successful.reduce((sum, r) => sum + r.time, 0) / successful.length;
    console.log('⚡ Performance:');
    console.log(`   Average time: ${(avgTime / 1000).toFixed(1)}s`);
    console.log(`   Template approach: ~${(avgTime / 1000).toFixed(1)}s`);
    console.log(`   With scraping: ~4-6s`);
    console.log(`   Improvement: ~${(((4.5 - avgTime / 1000) / 4.5) * 100).toFixed(0)}% faster`);
    console.log('');

    console.log('📄 Generated Files:');
    successful.forEach(r => {
      console.log(`   ✅ ${r.file}`);
    });
  }

  if (failed.length > 0) {
    console.log('');
    console.log('❌ Failed Keywords:');
    failed.forEach(r => {
      console.log(`   • ${r.keyword}: ${r.error}`);
    });
  }
}

testGeneration().catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});
