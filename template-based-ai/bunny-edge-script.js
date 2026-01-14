/**
 * Bunny CDN Edge Script: AI Content Generation + Bunny Storage Upload (Google Bot Only)
 * 
 * This Edge Script:
 * 1. Checks Bunny Storage for existing content
 * 2. Generates AI content only for Google bot if not in storage
 * 3. Uploads generated content to Bunny Storage for persistence
 * 4. Serves content directly
 * 
 * Configuration (set in Bunny CDN dashboard):
 * - OPENAI_API_KEY: OpenAI API key
 * - BUNNY_STORAGE_ZONE_NAME: Bunny Storage Zone name
 * - BUNNY_ACCESS_KEY: Bunny Storage Access Key (from FTP & API Access)
 * - BUNNY_REGION: Bunny Storage region (e.g., "ny", "sg", "de")
 * - BUNNY_PULL_ZONE_URL: Pull Zone URL for public access (optional)
 * - ORIGINAL_SITE_URL: Original site URL to fetch HTML structure
 * - FIXED_ORIGIN_PATH: Fixed origin path for canonical URL
 * 
 * Note: Bunny CDN Edge Scripts run at edge locations
 * Content is uploaded to Bunny Storage after generation for persistence
 */

// Import Bunny CDN Edge Script SDK
import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.11";
// Import process for environment variables
import process from "node:process";

// Configuration (set via Bunny CDN Edge Script Environment Variables)
// Reference: https://docs.bunny.net/docs/edge-scripting-environment-variables-and-secrets
const CONFIG = {
  storageZone: (process.env.BUNNY_STORAGE_ZONE_NAME || '').trim(),
  accessKey: (process.env.BUNNY_ACCESS_KEY || '').trim(), // Trim whitespace
  region: (process.env.BUNNY_REGION || 'ny').trim(),
  pullZoneUrl: (process.env.BUNNY_PULL_ZONE_URL || '').trim(),
  originalSiteUrl: process.env.ORIGINAL_SITE_URL || 'https://www.packaginginsights.com',
  fixedOriginPath: process.env.FIXED_ORIGIN_PATH || '/video/drinktec-2025-sidel-debuts-laser-blowing.html',
  useFixedOrigin: process.env.USE_FIXED_ORIGIN !== 'false',
  aiEnabled: process.env.AI_ENABLED !== 'false',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  uploadToBunny: process.env.UPLOAD_TO_BUNNY !== 'false',
  pathPrefix: process.env.BUNNY_PATH_PREFIX || 'video/',
  timeout: parseInt(process.env.TIMEOUT || '25000', 10)
};

/**
 * Get Bunny Storage endpoint based on region
 */
function getStorageEndpoint(region) {
  // Frankfurt uses different endpoint
  if (region === 'de') {
    return 'storage.bunnycdn.com';
  }
  // Other regions use {region}.storage.bunnycdn.com
  return `${region}.storage.bunnycdn.com`;
}

/**
 * Check if request is from Google bot
 */
function isGoogleBot(userAgent) {
  if (!userAgent) return false;
  const googleBotPatterns = [
    /Googlebot/i,
    /Google-InspectionTool/i,
    /Google-Inspection/i,
    /Mediapartners-Google/i,
    /AdsBot-Google/i,
    /APIs-Google/i,
    /DuplexWeb-Google/i,
    /FeedFetcher-Google/i,
    /Google-Read-Aloud/i,
    /Google-Site-Verification/i,
    /Google-StructuredDataTestingTool/i
  ];
  return googleBotPatterns.some(pattern => pattern.test(userAgent));
}

/**
 * Extract keyword from URL path
 */
function extractKeywordFromPath(urlPath) {
  if (!urlPath || typeof urlPath !== 'string') {
    return '';
  }
  const cleanPath = urlPath.replace(/^\/|\/$/g, '');
  if (!cleanPath) {
    return '';
  }
  const segments = cleanPath.split('/');
  const lastSegment = segments[segments.length - 1] || '';
  if (!lastSegment) {
    return '';
  }
  const keyword = lastSegment.replace(/\.(html|htm)$/i, '');
  return keyword.replace(/[-_]/g, ' ').trim();
}

/**
 * Generate Bunny Storage key from request URI
 */
function getBunnyKey(uri) {
  // Handle root path
  if (!uri || uri === '/' || uri === '') {
    return 'index.html'; // Root path becomes index.html
  }
  
  let key = uri.replace(/^\//, '');
  
  // Handle empty key (shouldn't happen, but safety check)
  if (!key || key === '') {
    key = 'index.html';
  }
  
  // Add .html extension if not present
  if (!key.endsWith('.html') && !key.endsWith('.htm')) {
    key = key.endsWith('/') ? key + 'index.html' : key + '.html';
  }
  
  // Add path prefix if configured (avoid duplication)
  if (CONFIG.pathPrefix) {
    const cleanPrefix = CONFIG.pathPrefix.replace(/\/$/, '').replace(/^\//, '');
    const cleanKey = key.replace(/^\//, '');
    
    // Check if key already starts with prefix to avoid duplication
    if (!cleanKey.startsWith(cleanPrefix + '/')) {
      key = cleanPrefix + '/' + cleanKey;
    } else {
      key = cleanKey; // Already has prefix, use as is
    }
  }
  
  return key;
}

/**
 * Check if object exists in Bunny Storage
 * If HEAD request fails with 401, try GET to verify content exists
 */
async function checkBunnyObject(key) {
  if (!CONFIG.storageZone || !CONFIG.accessKey) {
    console.log(`⚠️  Cannot check Bunny Storage: storageZone=${!!CONFIG.storageZone}, accessKey=${!!CONFIG.accessKey}`);
    return false;
  }
  
  const endpoint = getStorageEndpoint(CONFIG.region);
  const checkUrl = `https://${endpoint}/${CONFIG.storageZone}/${key}`;
  
  console.log(`🔍 Checking Bunny Storage: ${checkUrl}`);
  
  try {
    // Try HEAD request first
    const response = await fetch(checkUrl, {
      method: 'HEAD',
      headers: {
        'AccessKey': CONFIG.accessKey
      }
    });
    
    console.log(`📥 HEAD response: ${response.status} ${response.statusText}`);
    
    if (response.status === 200) {
      console.log(`✅ Content exists in Bunny Storage: ${key}`);
      return true;
    } else if (response.status === 404) {
      console.log(`❌ Content not found in Bunny Storage: ${key}`);
      return false;
    } else if (response.status === 401) {
      // 401 on HEAD might mean auth issue, but content might still exist
      // Try GET request to verify (if content exists, GET might work even if HEAD doesn't)
      console.log(`⚠️  401 on HEAD request, trying GET to verify content existence...`);
      try {
        const getResponse = await fetch(checkUrl, {
          method: 'GET',
          headers: {
            'AccessKey': CONFIG.accessKey
          }
        });
        
        console.log(`📥 GET response: ${getResponse.status} ${getResponse.statusText}`);
        
        if (getResponse.status === 200) {
          console.log(`✅ Content exists (verified via GET): ${key}`);
          return true;
        } else if (getResponse.status === 404) {
          console.log(`❌ Content not found (verified via GET): ${key}`);
          return false;
        } else {
          console.log(`⚠️  GET also returned ${getResponse.status}, assuming content doesn't exist`);
          return false;
        }
      } catch (getError) {
        console.error(`❌ Error on GET fallback: ${getError.message}`);
        return false;
      }
    } else {
      console.log(`⚠️  Unexpected status when checking: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error checking Bunny Storage: ${error.message}`);
    return false;
  }
}

/**
 * Get object from Bunny Storage
 */
async function getBunnyObject(key) {
  if (!CONFIG.storageZone || !CONFIG.accessKey) {
    return null;
  }
  
  const endpoint = getStorageEndpoint(CONFIG.region);
  const getUrl = `https://${endpoint}/${CONFIG.storageZone}/${key}`;
  
  try {
    const response = await fetch(getUrl, {
      method: 'GET',
      headers: {
        'AccessKey': CONFIG.accessKey
      }
    });
    
    if (response.status === 200) {
      return await response.text();
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Upload object to Bunny Storage
 */
async function uploadToBunnyStorage(key, content) {
  console.log(`🔍 uploadToBunnyStorage called: key=${key}, contentLength=${content?.length || 0}`);
  console.log(`🔍 Config check: uploadToBunny=${CONFIG.uploadToBunny}, storageZone=${CONFIG.storageZone ? 'SET' : 'NOT SET'}, accessKey=${CONFIG.accessKey ? 'SET' : 'NOT SET'}`);
  
  if (!CONFIG.uploadToBunny) {
    console.log(`ℹ️  Bunny Storage upload is disabled (UPLOAD_TO_BUNNY=false)`);
    return false;
  }
  
  // Validate configuration
  if (!CONFIG.storageZone || CONFIG.storageZone.trim() === '') {
    console.error(`❌ BUNNY_STORAGE_ZONE_NAME is not set!`);
    console.error(`   Current value: "${CONFIG.storageZone}"`);
    console.error(`   Set BUNNY_STORAGE_ZONE_NAME in Bunny CDN Edge Script environment variables`);
    return false;
  }
  
  if (!CONFIG.accessKey || CONFIG.accessKey.trim() === '') {
    console.error(`❌ BUNNY_ACCESS_KEY is not set!`);
    console.error(`   Current value: "${CONFIG.accessKey ? 'SET (but empty)' : 'NOT SET'}"`);
    console.error(`   Set BUNNY_ACCESS_KEY in Bunny CDN Edge Script environment variables`);
    return false;
  }
  
  // Clean key (remove leading slash)
  const cleanKey = key.startsWith('/') ? key.slice(1) : key;
  
  console.log(`📤 Uploading to Bunny Storage:`);
  console.log(`   Zone: "${CONFIG.storageZone}"`);
  console.log(`   Key: ${cleanKey}`);
  console.log(`   Region: "${CONFIG.region}"`);
  console.log(`   Content Size: ${content.length} bytes`);
  console.log(`   AccessKey length: ${CONFIG.accessKey.length} chars`);
  console.log(`   AccessKey preview: ${CONFIG.accessKey.substring(0, 10)}...${CONFIG.accessKey.substring(CONFIG.accessKey.length - 4)}`);
  console.log(`   AccessKey has spaces: ${CONFIG.accessKey.includes(' ')}`);
  console.log(`   AccessKey has quotes: ${CONFIG.accessKey.includes('"') || CONFIG.accessKey.includes("'")}`);
  
  // Additional validation
  if (CONFIG.accessKey.length < 20) {
    console.error(`❌ AccessKey too short (${CONFIG.accessKey.length} chars). Should be 40+ characters.`);
    return false;
  }
  
  try {
    const endpoint = getStorageEndpoint(CONFIG.region);
    const uploadUrl = `https://${endpoint}/${CONFIG.storageZone}/${cleanKey}`;
    
    console.log(`📤 Upload URL: ${uploadUrl}`);
    console.log(`📤 Full endpoint: ${endpoint}`);
    console.log(`📤 Request headers: AccessKey=${CONFIG.accessKey.substring(0, 10)}..., Content-Type=text/html`);
    
    // Make sure AccessKey doesn't have quotes or extra spaces
    const cleanAccessKey = CONFIG.accessKey.replace(/^["']|["']$/g, '').trim();
    
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': cleanAccessKey,
        'Content-Type': 'text/html; charset=utf-8'
      },
      body: content
    });
    
    console.log(`📥 Response status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      console.log(`✅ Successfully uploaded to Bunny Storage: ${cleanKey}`);
      console.log(`   URL: ${uploadUrl}`);
      return true;
    } else {
      const errorText = await response.text().catch(() => '');
      console.error(`❌ Bunny Storage upload failed: ${response.status} ${response.statusText}`);
      console.error(`   Upload URL: ${uploadUrl}`);
      console.error(`   Error response: ${errorText.substring(0, 500)}`);
      
      if (response.status === 401) {
        console.error(`   ⚠️  401 Unauthorized - AccessKey authentication failed`);
        console.error(`   Troubleshooting:`);
        console.error(`   1. Verify BUNNY_ACCESS_KEY is correct`);
        console.error(`   2. AccessKey should be from: Storage Zone → FTP & API Access → Password`);
        console.error(`   3. AccessKey is NOT the same as API Key (Pull Zone API Key)`);
        console.error(`   4. AccessKey length should be 40+ characters`);
        console.error(`   5. Make sure there are no extra spaces or quotes in the value`);
        console.error(`   6. Current AccessKey length: ${CONFIG.accessKey.length} chars`);
        console.error(`   7. Current AccessKey preview: ${CONFIG.accessKey.substring(0, 10)}...${CONFIG.accessKey.substring(CONFIG.accessKey.length - 4)}`);
        console.error(`   8. Storage Zone: "${CONFIG.storageZone}" (verify this matches your storage zone name)`);
        console.error(`   9. Region: "${CONFIG.region}" (verify this matches your storage zone region)`);
        console.error(`   10. Try regenerating AccessKey: Storage Zone → FTP & API Access → Reset Password`);
        console.error(`   11. Verify AccessKey format: Should be alphanumeric with hyphens (e.g., f58fc3af-9xxx-xxxx-xxxx-xxxx4957)`);
      }
      
      console.error(`   Other checks:`);
      console.error(`   - BUNNY_STORAGE_ZONE_NAME: "${CONFIG.storageZone}"`);
      console.error(`   - BUNNY_REGION: "${CONFIG.region}" (should match storage zone region)`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error uploading to Bunny Storage: ${error.message}`);
    console.error(`   Error stack: ${error.stack}`);
    console.error(`   Zone: ${CONFIG.storageZone}, Key: ${cleanKey}, Region: ${CONFIG.region}`);
    console.error(`   Endpoint: ${getStorageEndpoint(CONFIG.region)}`);
    return false;
  }
}

/**
 * Generate AI content from keyword
 */
async function generateAIContent(keyword) {
  console.log(`🤖 generateAIContent called with keyword: ${keyword}`);
  console.log(`📋 Config check: aiEnabled=${CONFIG.aiEnabled}, hasApiKey=${!!CONFIG.openaiApiKey}`);
  
  if (!CONFIG.aiEnabled) {
    console.error('❌ AI is disabled in config');
    return null;
  }
  
  if (!CONFIG.openaiApiKey || CONFIG.openaiApiKey.trim() === '') {
    console.error('❌ OpenAI API key is missing or empty!');
    console.error('   Check environment variable: OPENAI_API_KEY');
    return null;
  }

  try {
    const prompt = `Generate SEO-optimized video content for keyword: "${keyword}"

Generate comprehensive, SEO-focused content that will rank well in search engines.

Requirements:
1. TITLE (60-70 characters, SEO-optimized)
2. DESCRIPTION - META (155-160 characters)
3. DESCRIPTION - PARAGRAPH (250-350 characters)
4. KEYWORDS (comma-separated, 5-10 keywords)

Return ONLY a valid JSON object:
{
  "title": "SEO-optimized title here",
  "description": {
    "meta": "Meta description (155-160 chars)",
    "paragraph": "Paragraph content (250-350 chars)"
  },
  "keywords": "keyword1, keyword2, keyword3"
}`;

    console.log(`📤 Calling OpenAI API for keyword: ${keyword}`);
    const apiKeyPreview = CONFIG.openaiApiKey.substring(0, 10) + '...';
    console.log(`🔑 API Key preview: ${apiKeyPreview}`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an SEO expert. Generate natural, valuable, SEO-optimized content in JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    console.log(`📥 OpenAI API response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ OpenAI API error: ${response.status}`);
      console.error(`   Response: ${errorText.substring(0, 200)}`);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText.substring(0, 100)}`);
    }

    const data = await response.json();
    console.log(`✅ OpenAI API response received`);
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('❌ Invalid OpenAI API response structure');
      throw new Error('Invalid OpenAI API response structure');
    }
    
    const contentText = data.choices[0].message.content;
    console.log(`📝 Parsing AI content: ${contentText.substring(0, 100)}...`);
    
    const content = JSON.parse(contentText);
    console.log(`✅ AI content generated successfully`);
    
    return content;
  } catch (error) {
    console.error('❌ Error generating AI content:', error.message);
    return null;
  }
}

/**
 * Fetch original HTML from original site
 */
async function fetchOriginalHTML(originalUrl) {
  try {
    const response = await fetch(originalUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    if (response.ok) {
      return await response.text();
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching original HTML:', error.message);
    return null;
  }
}

/**
 * Generate HTML template with AI content
 */
function generateHTMLTemplate(aiContent, requestPath) {
  const title = aiContent?.title || 'Content';
  const metaDesc = aiContent?.description?.meta || '';
  const keywords = aiContent?.keywords || '';
  const paragraph = aiContent?.description?.paragraph || '';
  const canonicalUrl = `${CONFIG.originalSiteUrl}${CONFIG.fixedOriginPath}`;
  const ogUrl = canonicalUrl;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${metaDesc}">
  <meta name="keywords" content="${keywords}">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${metaDesc}">
  <meta property="og:url" content="${ogUrl}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${metaDesc}">
  <meta name="robots" content="index, follow">
</head>
<body>
  <main>
    <article>
      <h1>${title}</h1>
      <p>${paragraph}</p>
    </article>
  </main>
</body>
</html>`;
}

/**
 * Replace content in HTML with AI content
 */
function replaceContentInHTML(html, aiContent, canonicalUrl, ogUrl) {
  if (!aiContent) {
    return html;
  }

  try {
    let modifiedHTML = html;

    // Replace title
    if (aiContent.title) {
      modifiedHTML = modifiedHTML.replace(
        /<title>.*?<\/title>/i,
        `<title>${aiContent.title}</title>`
      );
      modifiedHTML = modifiedHTML.replace(
        /<meta\s+property=["']og:title["']\s+content=["'][^"']*["']/i,
        `<meta property="og:title" content="${aiContent.title}"`
      );
      modifiedHTML = modifiedHTML.replace(
        /<meta\s+name=["']twitter:title["']\s+content=["'][^"']*["']/i,
        `<meta name="twitter:title" content="${aiContent.title}"`
      );
    }

    // Replace meta description
    if (aiContent.description?.meta) {
      modifiedHTML = modifiedHTML.replace(
        /<meta\s+name=["']description["']\s+content=["'][^"']*["']/i,
        `<meta name="description" content="${aiContent.description.meta}"`
      );
      modifiedHTML = modifiedHTML.replace(
        /<meta\s+property=["']og:description["']\s+content=["'][^"']*["']/i,
        `<meta property="og:description" content="${aiContent.description.meta}"`
      );
      modifiedHTML = modifiedHTML.replace(
        /<meta\s+name=["']twitter:description["']\s+content=["'][^"']*["']/i,
        `<meta name="twitter:description" content="${aiContent.description.meta}"`
      );
    }

    // Replace keywords
    if (aiContent.keywords) {
      modifiedHTML = modifiedHTML.replace(
        /<meta\s+name=["']keywords["']\s+content=["'][^"']*["']/i,
        `<meta name="keywords" content="${aiContent.keywords}"`
      );
    }

    // Ensure canonical URL
    if (canonicalUrl) {
      modifiedHTML = modifiedHTML.replace(
        /<link\s+rel=["']canonical["'][^>]*>/i,
        `<link rel="canonical" href="${canonicalUrl}">`
      );
      if (!modifiedHTML.includes('rel="canonical"')) {
        modifiedHTML = modifiedHTML.replace(
          '</head>',
          `  <link rel="canonical" href="${canonicalUrl}">\n</head>`
        );
      }
    }

    // Ensure OG URL
    if (ogUrl) {
      modifiedHTML = modifiedHTML.replace(
        /<meta\s+property=["']og:url["']\s+content=["'][^"']*["']/i,
        `<meta property="og:url" content="${ogUrl}"`
      );
      if (!modifiedHTML.includes('property="og:url"')) {
        modifiedHTML = modifiedHTML.replace(
          '</head>',
          `  <meta property="og:url" content="${ogUrl}">\n</head>`
        );
      }
    }

    return modifiedHTML;
  } catch (error) {
    console.error('Error replacing content:', error.message);
    return html;
  }
}

/**
 * Replace all dates in HTML with today's date
 */
function replaceDatesInHTML(html) {
  if (!html || typeof html !== 'string') {
    return html;
  }

  try {
    let modifiedHTML = html;
    
    // Get today's date in various formats
    const today = new Date();
    const todayISO = today.toISOString();
    const todayISOShort = todayISO.split('.')[0] + '+00:00';
    const todayDateOnly = todayISO.split('T')[0];
    const todayFormatted = today.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
    const todayFormattedUS = today.toLocaleDateString('en-US', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });

    // Replace dates in JSON-LD schema
    modifiedHTML = modifiedHTML.replace(
      /("uploadDate"|"datePublished"|"dateModified"|"@date"|"dateCreated")\s*:\s*"([^"]+)"/gi,
      (match, key, dateValue) => {
        return `${key}: "${todayISOShort}"`;
      }
    );

    // Replace dates in meta tags
    modifiedHTML = modifiedHTML.replace(
      /<meta\s+property=["']article:(published_time|modified_time)["']\s+content=["']([^"']+)["']/gi,
      (match, type, dateValue) => {
        return `<meta property="article:${type}" content="${todayDateOnly}"`;
      }
    );

    modifiedHTML = modifiedHTML.replace(
      /<meta\s+name=["'](date|pubdate|publishdate)["']\s+content=["']([^"']+)["']/gi,
      (match, name, dateValue) => {
        return `<meta name="${name}" content="${todayDateOnly}"`;
      }
    );

    console.log(`✅ Dates replaced with today's date: ${todayDateOnly}`);
    return modifiedHTML;
  } catch (error) {
    console.error('Error replacing dates in HTML:', error.message);
    return html;
  }
}

/**
 * Bunny CDN Edge Script handler
 */
BunnySDK.net.http.serve(async (request) => {
    try {
      console.log('🚀 Bunny CDN Edge Script started');
      
      // Validate critical environment variables at startup
      if (!CONFIG.storageZone || CONFIG.storageZone.trim() === '') {
        console.error('❌ CRITICAL: BUNNY_STORAGE_ZONE_NAME is not set!');
        console.error('   Set BUNNY_STORAGE_ZONE_NAME in Bunny CDN Edge Script environment variables');
        return new Response(
          `<!DOCTYPE html><html><head><title>Configuration Error</title></head><body><h1>Configuration Error</h1><p>BUNNY_STORAGE_ZONE_NAME is not configured. Please set it in Edge Script environment variables.</p></body></html>`,
          {
            status: 500,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          }
        );
      }
      
      if (!CONFIG.accessKey || CONFIG.accessKey.trim() === '') {
        console.error('❌ CRITICAL: BUNNY_ACCESS_KEY is not set!');
        console.error('   Set BUNNY_ACCESS_KEY in Bunny CDN Edge Script environment variables');
        return new Response(
          `<!DOCTYPE html><html><head><title>Configuration Error</title></head><body><h1>Configuration Error</h1><p>BUNNY_ACCESS_KEY is not configured. Please set it in Edge Script environment variables.</p></body></html>`,
          {
            status: 500,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          }
        );
      }
      
      // Get request details
      let url, uri, userAgent;
      try {
        url = new URL(request.url);
        uri = url.pathname || '/';
        userAgent = request.headers.get('user-agent') || '';
        console.log(`📥 Request URL: ${request.url}`);
        console.log(`📥 Request URI: ${uri}`);
      } catch (urlError) {
        console.error('❌ Error parsing URL:', urlError);
        return new Response(
          `<!DOCTYPE html><html><head><title>Bad Request</title></head><body><h1>Invalid URL</h1><p>Error: ${urlError.message}</p></body></html>`,
          {
            status: 400,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          }
        );
      }
      
      const isGoogle = isGoogleBot(userAgent);
      console.log(`📥 User-Agent: ${userAgent.substring(0, 50)}...`);
      console.log(`📥 Is Google Bot: ${isGoogle}`);
      
      // Get Bunny Storage key (with prefix)
      const bunnyKey = getBunnyKey(uri);
      console.log(`🔑 Generated Bunny Storage key (with prefix): ${bunnyKey} (from URI: ${uri})`);
      
      // Also check root path (without prefix) in case file exists in root
      // Root key = URI path without the configured prefix
      let rootKey = uri.replace(/^\//, '');
      if (!rootKey || rootKey === '') {
        rootKey = 'index.html';
      } else {
        // Add .html extension if not present
        if (!rootKey.endsWith('.html') && !rootKey.endsWith('.htm')) {
          rootKey = rootKey.endsWith('/') ? rootKey + 'index.html' : rootKey + '.html';
        }
        // Remove leading slash if any
        rootKey = rootKey.replace(/^\//, '');
      }
      
      // If pathPrefix is configured, remove it from rootKey to check root location
      let rootKeyWithoutPrefix = rootKey;
      if (CONFIG.pathPrefix) {
        const cleanPrefix = CONFIG.pathPrefix.replace(/\/$/, '').replace(/^\//, '');
        // If rootKey starts with prefix, remove it to get root location
        if (rootKey.startsWith(cleanPrefix + '/')) {
          rootKeyWithoutPrefix = rootKey.substring(cleanPrefix.length + 1);
        }
      }
      
      console.log(`🔑 Root key (without prefix): ${rootKeyWithoutPrefix}`);
      console.log(`🔑 Full URI key: ${rootKey}`);
      
      // Check Bunny Storage for existing content FIRST
      // Try both: with prefix and without prefix (root)
      console.log(`🔍 Checking if content exists in Bunny Storage...`);
      
      let existsInBunny = false;
      let foundKey = null;
      let content = null;
      
      // First, try with prefix (video/...)
      if (bunnyKey !== rootKey) {
        console.log(`   1. Checking with prefix: ${bunnyKey}`);
        existsInBunny = await checkBunnyObject(bunnyKey);
        if (existsInBunny) {
          foundKey = bunnyKey;
          console.log(`   ✅ Found with prefix: ${bunnyKey}`);
        }
      }
      
      // If not found with prefix, try root (without prefix)
      if (!existsInBunny && rootKeyWithoutPrefix && rootKeyWithoutPrefix !== bunnyKey) {
        console.log(`   2. Checking root (without prefix): ${rootKeyWithoutPrefix}`);
        const existsInRoot = await checkBunnyObject(rootKeyWithoutPrefix);
        if (existsInRoot) {
          existsInBunny = true;
          foundKey = rootKeyWithoutPrefix;
          console.log(`   ✅ Found in root: ${rootKeyWithoutPrefix}`);
        }
      }
      
      // Also try the full URI path (in case file is at exact URI location)
      if (!existsInBunny && rootKey && rootKey !== bunnyKey && rootKey !== rootKeyWithoutPrefix) {
        console.log(`   3. Checking full URI path: ${rootKey}`);
        const existsInFullPath = await checkBunnyObject(rootKey);
        if (existsInFullPath) {
          existsInBunny = true;
          foundKey = rootKey;
          console.log(`   ✅ Found at full URI path: ${rootKey}`);
        }
      }
      
      // If found, get and serve content
      if (existsInBunny && foundKey) {
        // Content exists in Bunny Storage, fetch and serve to ALL users
        console.log(`✅ Content found in Bunny Storage: ${foundKey}`);
        console.log(`   Serving to ${isGoogle ? 'Google Bot' : 'regular user'}`);
        content = await getBunnyObject(foundKey);
        
        if (content) {
          console.log(`✅ Successfully retrieved content from Bunny Storage (${content.length} bytes)`);
          return new Response(content, {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'X-Bunny-Cache': 'HIT',
              'X-Source': 'Bunny-Storage',
              'X-Access': 'Public', // Content is available to all users
              'X-Location': foundKey === rootKey ? 'root' : 'prefixed',
              'Cache-Control': 'public, max-age=86400'
            }
          });
        } else {
          console.error(`⚠️  Content exists but failed to retrieve: ${foundKey}`);
          console.error(`   This might be an authentication issue with AccessKey`);
        }
      } else {
        // Content doesn't exist, but if check returned 401, it might be an auth issue
        // Try to get content anyway (fallback) - try both paths
        console.log(`⚠️  Content check returned false, trying GET as fallback...`);
        
        // Try with prefix first
        if (bunnyKey !== rootKey) {
          console.log(`   Trying GET with prefix: ${bunnyKey}`);
          content = await getBunnyObject(bunnyKey);
          if (content) {
            console.log(`✅ Content retrieved via GET fallback (with prefix, ${content.length} bytes)`);
            console.log(`   Serving to ${isGoogle ? 'Google Bot' : 'regular user'}`);
            return new Response(content, {
              status: 200,
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'X-Bunny-Cache': 'HIT',
                'X-Source': 'Bunny-Storage-Fallback',
                'X-Access': 'Public',
                'X-Location': 'prefixed',
                'Cache-Control': 'public, max-age=86400'
              }
            });
          }
        }
        
        // Try root without prefix if prefix didn't work
        if (rootKeyWithoutPrefix && rootKeyWithoutPrefix !== bunnyKey && !content) {
          console.log(`   Trying GET in root (without prefix): ${rootKeyWithoutPrefix}`);
          content = await getBunnyObject(rootKeyWithoutPrefix);
          if (content) {
            console.log(`✅ Content retrieved via GET fallback (in root, ${content.length} bytes)`);
            console.log(`   Serving to ${isGoogle ? 'Google Bot' : 'regular user'}`);
            return new Response(content, {
              status: 200,
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'X-Bunny-Cache': 'HIT',
                'X-Source': 'Bunny-Storage-Fallback',
                'X-Access': 'Public',
                'X-Location': 'root',
                'Cache-Control': 'public, max-age=86400'
              }
            });
          }
        }
        
        // Try full URI path as last resort
        if (rootKey && rootKey !== bunnyKey && rootKey !== rootKeyWithoutPrefix && !content) {
          console.log(`   Trying GET at full URI path: ${rootKey}`);
          content = await getBunnyObject(rootKey);
          if (content) {
            console.log(`✅ Content retrieved via GET fallback (full path, ${content.length} bytes)`);
            console.log(`   Serving to ${isGoogle ? 'Google Bot' : 'regular user'}`);
            return new Response(content, {
              status: 200,
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'X-Bunny-Cache': 'HIT',
                'X-Source': 'Bunny-Storage-Fallback',
                'X-Access': 'Public',
                'X-Location': 'full-path',
                'Cache-Control': 'public, max-age=86400'
              }
            });
          }
        }
      }
      
      // Content not in Bunny Storage
      console.log(`⚠️  Content not found in Bunny Storage: ${bunnyKey}`);
      console.log(`   This means content hasn't been generated/uploaded yet`);
      
      // Only generate NEW content for Google bot
      // Regular users will get 404 until content is generated and uploaded
      if (!isGoogle) {
        // Not Google bot and content doesn't exist yet, return 404
        console.log(`   Regular user requested non-existent content, returning 404`);
        return new Response(
          '<!DOCTYPE html><html><head><title>Not Found</title></head><body><h1>Content not available</h1><p>This content is only available for search engine crawlers.</p><p>Please wait for the content to be indexed by search engines.</p></body></html>',
          {
            status: 404,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'X-Source': 'Bunny-Edge',
              'X-Reason': 'Content not generated yet - Only Google Bot can trigger generation'
            }
          }
        );
      }
      
      // Google bot request, generate content
      console.log(`🤖 Generating AI content for Google bot: ${uri}`);
      
      // Extract keyword (handle root path)
      let keyword = extractKeywordFromPath(uri);
      console.log(`🔑 Extracted keyword from URI "${uri}": "${keyword}"`);
      
      // If root path or no keyword, use default keyword
      if (!keyword || keyword.length === 0 || uri === '/' || uri === '') {
        console.log(`⚠️  No keyword extracted from "${uri}", using default keyword`);
        keyword = 'home page'; // Default keyword for root path
        console.log(`🔑 Using default keyword: "${keyword}"`);
      }
      
      // Generate AI content
      console.log(`🚀 Starting AI content generation...`);
      const aiContent = await generateAIContent(keyword);
      
      if (!aiContent) {
        console.error('❌ AI content generation failed!');
        return new Response(
          '<!DOCTYPE html><html><head><title>AI Generation Failed</title></head><body><h1>Content Generation Failed</h1><p>Unable to generate AI content. Please check logs and ensure OPENAI_API_KEY is set correctly.</p></body></html>',
          {
            status: 500,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          }
        );
      }
      
      console.log(`✅ AI content generated: ${JSON.stringify(aiContent).substring(0, 100)}...`);
      
      // Fetch original HTML
      const originPath = CONFIG.useFixedOrigin ? CONFIG.fixedOriginPath : uri;
      const originalUrl = `${CONFIG.originalSiteUrl}${originPath}`;
      const canonicalUrl = `${CONFIG.originalSiteUrl}${CONFIG.fixedOriginPath}`;
      const ogUrl = canonicalUrl;
      
      const originalHTML = await fetchOriginalHTML(originalUrl);
      
      // Generate final HTML
      let finalHTML;
      if (!originalHTML) {
        // Generate template
        finalHTML = generateHTMLTemplate(aiContent, uri);
      } else {
        // Replace content
        finalHTML = replaceContentInHTML(originalHTML, aiContent, canonicalUrl, ogUrl);
      }
      
      // Replace all dates with today's date
      console.log(`📅 Replacing all dates with today's date.`);
      finalHTML = replaceDatesInHTML(finalHTML);
      
      // Upload to Bunny Storage (await to ensure it completes and logs errors)
      console.log(`📤 Starting upload to Bunny Storage: ${bunnyKey}`);
      try {
        const uploadSuccess = await uploadToBunnyStorage(bunnyKey, finalHTML);
        if (uploadSuccess) {
          console.log(`✅ Content uploaded to Bunny Storage successfully: ${bunnyKey}`);
        } else {
          console.error(`⚠️  Content upload to Bunny Storage failed: ${bunnyKey}`);
          console.error(`   Content will be served from edge cache only (not persisted)`);
        }
      } catch (uploadError) {
        console.error(`❌ Exception during Bunny Storage upload: ${uploadError.message}`);
        console.error(`   Stack: ${uploadError.stack}`);
      }
      
      // Serve generated HTML immediately
      return new Response(finalHTML, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=86400',
          'X-Bunny-Cache': 'MISS',
          'X-Source': 'Bunny-Edge-Generated',
          'X-Upload': CONFIG.uploadToBunny ? 'pending' : 'disabled'
        }
      });
      
    } catch (error) {
      console.error('❌ Bunny CDN Edge Script error:', error);
      console.error('❌ Error stack:', error.stack);
      return new Response(
        `<!DOCTYPE html><html><head><title>Error</title></head><body><h1>Internal Server Error</h1><p>${error.message || 'UnknownError'}</p></body></html>`,
        {
          status: 500,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        }
      );
    }
});
