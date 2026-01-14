/**
 * Dynamic Route Page with RAW HTML Output
 * Returns pure HTML without Next.js wrapper (like contoh.html)
 */

import { GetServerSideProps } from 'next';
import { generateAIContent } from '@/lib/ai-content';
import { fetchOriginalHTML, replaceContentInHTML, replaceDatesInHTML, convertToRelativePaths, removeImagePreloads, removeMenuDiv, beautifyHTML, generateHTMLTemplate, extractHeadAssets } from '@/lib/html-utils';
import { cache as contentCache } from '@/lib/cache';
import { optimizeHTML } from '@/lib/html-optimizer';

interface PageProps {}

export default function KeywordPage() {
  // This component will never render because we return raw HTML in getServerSideProps
  return null;
}

export const getServerSideProps: GetServerSideProps<PageProps> = async (context) => {
  const { keyword } = context.params as { keyword: string };
  const req = context.req;
  const res = context.res;
  const userAgent = req.headers['user-agent'] || '';
  const isGoogleBot = /googlebot/i.test(userAgent);

  console.log(`📥 Request received: /${keyword}`);
  console.log(`🤖 Is Google Bot: ${isGoogleBot}`);
  console.log(`📋 User-Agent: ${userAgent.substring(0, 50)}...`);

  // Configuration from environment variables
  const openaiApiKey = process.env.OPENAI_API_KEY || '';
  const originalSiteUrl = process.env.ORIGINAL_SITE_URL || 'https://www.packaginginsights.com';
  const fixedOriginPath = process.env.FIXED_ORIGIN_PATH || '/video/drinktec-2025-sidel-debuts-laser-blowing.html';
  const useFixedOrigin = process.env.USE_FIXED_ORIGIN !== 'false';

  try {
    // Check cache first
    const cached = contentCache.get(keyword);
    if (cached) {
      console.log(`🚀 Serving from cache (no scraping needed)`);
      
      // Return RAW HTML directly (bypass Next.js rendering)
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
      res.write(cached.fullHTML); // Full HTML including <html>, <head>, <body>
      res.end();
      
      return { props: {} };
    }
    
    console.log(`🔍 Cache MISS - will scrape and cache`);
    
    // AI generation enabled for testing
    console.log(`🚀 Generating AI content for keyword: ${keyword}`);
    
    const aiContent = await generateAIContent(keyword, {
      openaiApiKey,
      aiEnabled: true,
      timeout: 25000,
    });
    
    if (!aiContent) {
      console.error('❌ AI content generation failed!');
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.write('<h1>Error: Content Generation Failed</h1><p>Unable to generate AI content. Please check logs and ensure OPENAI_API_KEY is set correctly.</p>');
      res.end();
      return { props: {} };
    }
    
    console.log(`✅ AI content generated successfully`);

    // Try to fetch original HTML
    const originPath = useFixedOrigin ? fixedOriginPath : `/${keyword}.html`;
    const originalUrl = `${originalSiteUrl}${originPath}`;
    const canonicalUrl = `${originalSiteUrl}${fixedOriginPath}`;
    const ogUrl = canonicalUrl;

    console.log(`🌐 Fetching original HTML from: ${originalUrl}`);
    let originalHTML = await fetchOriginalHTML(originalUrl);
    let finalHTML = '';

    if (originalHTML) {
      console.log(`📝 Replacing content in original HTML`);
      finalHTML = replaceContentInHTML(originalHTML, aiContent, canonicalUrl, ogUrl);
      finalHTML = replaceDatesInHTML(finalHTML);
      
      // Convert absolute URLs to relative (like contoh.html)
      finalHTML = convertToRelativePaths(finalHTML);
      
      // Remove image preload tags (not in contoh.html)
      finalHTML = removeImagePreloads(finalHTML);
      
      // Remove menudiv navigation (not in contoh.html)
      finalHTML = removeMenuDiv(finalHTML);
      
      // Beautify HTML with proper line breaks (like contoh.html)
      finalHTML = beautifyHTML(finalHTML);
      
      console.log(`⚡ HTML formatted exactly like contoh.html...`);
    } else {
      console.log(`⚠️  Original HTML not found, generating from template`);
      finalHTML = generateHTMLTemplate(aiContent, `/${keyword}`, originalSiteUrl);
      finalHTML = replaceDatesInHTML(finalHTML);
      finalHTML = convertToRelativePaths(finalHTML);
      finalHTML = removeImagePreloads(finalHTML);
      finalHTML = removeMenuDiv(finalHTML);
      finalHTML = beautifyHTML(finalHTML);
    }

    console.log(`✅ Content ready (EXACT like contoh.html), size: ${finalHTML.length} bytes`);

    // Cache the FULL HTML (not just body) for future requests
    contentCache.set(keyword, finalHTML, aiContent, {
      cssLinks: [],
      inlineStyles: [],
      scripts: [],
      otherMeta: []
    });
    console.log(`💾 Full HTML cached for future requests`);

    // Return RAW HTML directly (bypass Next.js rendering)
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
    res.write(finalHTML);
    res.end();

    return { props: {} };
  } catch (error: any) {
    console.error('❌ Error in getServerSideProps:', error);
    
    // Return error page as raw HTML
    const errorHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error - Content Generation Failed</title>
  <meta name="robots" content="noindex, nofollow" />
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; padding: 2rem; text-align: center;">
  <h1>Content Generation Failed</h1>
  <p>${error.message || 'Unknown error occurred'}</p>
</body>
</html>
    `;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.write(errorHTML);
    res.end();
    
    return { props: {} };
  }
};
