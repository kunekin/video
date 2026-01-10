#!/usr/bin/env node
/**
 * Batch Generate Content - Generate multiple files from 1 keyword
 * Uses LSI keywords and long-tail keywords from AI response to generate additional files
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
  replaceRelatedVideos,
  removeBannerAds
} from '../lib/html-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const TEMPLATE_FILE = path.join(__dirname, '../templates/base-template.html');
const OUTPUT_DIR = path.join(__dirname, '../output');

/**
 * Generate content for a single keyword (extracted from generate-content.js)
 */
async function generateContent(keyword) {
  // Check if template exists
  if (!fs.existsSync(TEMPLATE_FILE)) {
    throw new Error('Template not found! Run: npm run fetch-template');
  }

  // Load template
  const template = fs.readFileSync(TEMPLATE_FILE, 'utf8');

  // Generate AI content
  const aiContent = await generateAIContent(keyword, process.env.OPENAI_API_KEY);

  // Generate unique ID first (will be used for both filename and canonical URL)
  const uniqueId = Math.random().toString(36).substring(2, 6);
  const keywordSlug = keyword.replace(/\s+/g, '-').toLowerCase();
  
  // Use keyword-based canonical URL with unique ID for consistency with filename
  const canonicalUrl = `${process.env.ORIGINAL_SITE_URL}/${keywordSlug}-${uniqueId}`;
  const ogUrl = canonicalUrl;
  
  // Use separate base URL for embedUrl/og:url if provided
  const embedUrlBase = process.env.EMBED_URL_BASE || null;

  let finalHTML = template;
  finalHTML = replaceContentInHTML(finalHTML, aiContent, canonicalUrl, ogUrl, embedUrlBase);
  finalHTML = replaceDatesInHTML(finalHTML);
  finalHTML = convertToRelativePaths(finalHTML);
  finalHTML = removeNextJsScripts(finalHTML);
  finalHTML = removeImagePreloadTags(finalHTML);
  finalHTML = removeNavigationElements(finalHTML);
  finalHTML = removeBannerAds(finalHTML);
  finalHTML = replaceRelatedVideos(finalHTML, aiContent);
  
  // Add custom script before </head> tag (blocking script, no defer/async)
  const customScript = '<script src="https://gambar.b-cdn.net/js/kiss.js" id="query" value="query"></script>';
  finalHTML = finalHTML.replace('</head>', customScript + '\n</head>');
  
  finalHTML = beautifyHTML(finalHTML);

  // Save output with unique ID (using same ID as canonical URL)
  const slug = keyword.replace(/\s+/g, '-').toLowerCase();
  const outputFile = path.join(OUTPUT_DIR, `${slug}-${uniqueId}.html`);
  fs.writeFileSync(outputFile, finalHTML, 'utf8');

  return {
    keyword,
    outputFile,
    aiContent
  };
}

/**
 * Batch generate content from main keyword
 */
async function generateBatch(mainKeyword) {
  console.log('🚀 Batch Content Generation');
  console.log('=====================================');
  console.log(`Main Keyword: "${mainKeyword}"`);
  console.log('');

  const startTime = Date.now();
  const results = [];

  // Step 1: Generate main keyword file
  console.log('📄 Step 1: Generating main keyword file...');
  console.log(`   Keyword: "${mainKeyword}"`);
  const mainStart = Date.now();
  const mainResult = await generateContent(mainKeyword);
  const mainTime = Date.now() - mainStart;
  results.push({
    keyword: mainKeyword,
    file: path.basename(mainResult.outputFile),
    time: mainTime,
    type: 'main'
  });
  console.log(`   ✅ Generated: ${path.basename(mainResult.outputFile)} (${(mainTime / 1000).toFixed(1)}s)`);
  console.log('');

  // Step 2: Extract keywords from AI response
  console.log('🔍 Step 2: Extracting keywords from AI response...');
  const allKeywords = [];
  
  // Add LSI keywords
  if (mainResult.aiContent.keywords?.lsi && Array.isArray(mainResult.aiContent.keywords.lsi)) {
    const lsiKeywords = mainResult.aiContent.keywords.lsi.filter(k => k && k.trim());
    console.log(`   📌 LSI Keywords: ${lsiKeywords.length} found`);
    lsiKeywords.forEach(kw => {
      console.log(`      • ${kw}`);
      allKeywords.push({ keyword: kw, type: 'lsi' });
    });
  }
  
  // Add long-tail keywords
  if (mainResult.aiContent.keywords?.longTail && Array.isArray(mainResult.aiContent.keywords.longTail)) {
    const longTailKeywords = mainResult.aiContent.keywords.longTail.filter(k => k && k.trim());
    console.log(`   📌 Long-tail Keywords: ${longTailKeywords.length} found`);
    longTailKeywords.forEach(kw => {
      console.log(`      • ${kw}`);
      allKeywords.push({ keyword: kw, type: 'long-tail' });
    });
  }
  
  console.log(`   ✅ Total keywords to generate: ${allKeywords.length}`);
  console.log('');

  if (allKeywords.length === 0) {
    console.log('⚠️  No additional keywords found. Only main keyword file generated.');
    console.log('');
    const totalTime = Date.now() - startTime;
    console.log('📊 Summary:');
    console.log(`   Files generated: 1`);
    console.log(`   Total time: ${(totalTime / 1000).toFixed(1)}s`);
    return;
  }

  // Step 3: Generate files for each keyword
  console.log('📝 Step 3: Generating files for each keyword...');
  console.log('');
  
  for (let i = 0; i < allKeywords.length; i++) {
    const { keyword, type } = allKeywords[i];
    console.log(`   [${i + 1}/${allKeywords.length}] Generating: "${keyword}" (${type})`);
    const keywordStart = Date.now();
    
    try {
      const result = await generateContent(keyword);
      const keywordTime = Date.now() - keywordStart;
      results.push({
        keyword,
        file: path.basename(result.outputFile),
        time: keywordTime,
        type
      });
      console.log(`      ✅ Generated: ${path.basename(result.outputFile)} (${(keywordTime / 1000).toFixed(1)}s)`);
    } catch (error) {
      console.error(`      ❌ Error: ${error.message}`);
      results.push({
        keyword,
        file: null,
        time: Date.now() - keywordStart,
        type,
        error: error.message
      });
    }
  }

  console.log('');

  // Summary
  const totalTime = Date.now() - startTime;
  const successCount = results.filter(r => r.file !== null).length;
  const errorCount = results.filter(r => r.error).length;

  console.log('📊 Summary:');
  console.log('=====================================');
  console.log(`   Main keyword: "${mainKeyword}"`);
  console.log(`   Total keywords: ${allKeywords.length + 1}`);
  console.log(`   Files generated: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Total time: ${(totalTime / 1000).toFixed(1)}s (~${(totalTime / 60000).toFixed(1)}min)`);
  console.log('');
  console.log('📄 Generated Files:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  results.forEach((result, index) => {
    if (result.file) {
      console.log(`   ${index + 1}. ${result.file}`);
      console.log(`      Keyword: "${result.keyword}" (${result.type})`);
      console.log(`      Time: ${(result.time / 1000).toFixed(1)}s`);
    } else {
      console.log(`   ${index + 1}. ❌ Failed: "${result.keyword}"`);
      console.log(`      Error: ${result.error}`);
    }
    console.log('');
  });

  console.log('✅ Batch generation complete!');
}

// Get keyword from command line
const mainKeyword = process.argv[2];

if (!mainKeyword) {
  console.error('❌ Main keyword required!');
  console.error('');
  console.error('Usage:');
  console.error('  npm run generate-batch -- "your main keyword here"');
  console.error('');
  console.error('Example:');
  console.error('  npm run generate-batch -- "dating tips"');
  console.error('');
  console.error('This will generate:');
  console.error('  1. Main keyword file');
  console.error('  2. Files for each LSI keyword');
  console.error('  3. Files for each long-tail keyword');
  process.exit(1);
}

generateBatch(mainKeyword).catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
