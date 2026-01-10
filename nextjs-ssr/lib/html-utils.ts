/**
 * HTML Utilities
 * Functions for fetching and manipulating HTML content
 */

const cheerio = require('cheerio');

/**
 * Fetch original HTML from a URL
 */
export async function fetchOriginalHTML(originalUrl: string): Promise<string | null> {
  try {
    const response = await fetch(originalUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    if (response.ok) {
      return await response.text();
    }

    return null;
  } catch (error: any) {
    console.error('Error fetching original HTML:', error.message);
    return null;
  }
}

/**
 * Extract CSS and JS from HTML head
 */
export function extractHeadAssets(html: string): {
  cssLinks: { href: string; rel: string }[];
  scripts: { src?: string; innerHTML?: string }[];
  inlineStyles: string[];
  otherMeta: string[];
} {
  try {
    const $ = cheerio.load(html);
    const cssLinks: { href: string; rel: string }[] = [];
    const scripts: { src?: string; innerHTML?: string }[] = [];
    const inlineStyles: string[] = [];
    const otherMeta: string[] = [];

    // Extract CSS links with proper structure
    $('head link[rel="stylesheet"]').each((_: any, elem: any) => {
      const href = $(elem).attr('href');
      const rel = $(elem).attr('rel') || 'stylesheet';
      if (href) {
        cssLinks.push({ href, rel });
      }
    });

  // Extract script tags with proper structure
  // Filter out Next.js scripts from external site to avoid conflict
  $('head script[src]').each((_: any, elem: any) => {
    const src = $(elem).attr('src');
    if (src) {
      // Skip Next.js runtime scripts that would conflict with our own Next.js app
      const isNextJsScript = src.includes('/_next/static/chunks/') || 
                             src.includes('/_next/static/development/') ||
                             src.includes('polyfills.js') ||
                             src.includes('webpack.js') ||
                             src.includes('main.js') ||
                             src.includes('_app.js') ||
                             src.includes('_buildManifest.js') ||
                             src.includes('_ssgManifest.js');
      
      if (!isNextJsScript) {
        scripts.push({ src });
      } else {
        console.log(`⚠️  Skipped Next.js script to avoid conflict: ${src.substring(0, 80)}...`);
      }
    }
  });

    // Extract inline script tags
    $('head script:not([src])').each((_: any, elem: any) => {
      const innerHTML = $(elem).html();
      if (innerHTML && innerHTML.trim()) {
        scripts.push({ innerHTML });
      }
    });

    // Extract inline styles
    $('head style').each((_: any, elem: any) => {
      const styleContent = $(elem).html();
      if (styleContent) {
        inlineStyles.push(styleContent);
      }
    });

    // Extract other meta tags and links (except title, description, keywords, og tags)
    $('head meta, head link').each((_: any, elem: any) => {
      const tag = elem.tagName.toLowerCase();
      if (tag === 'meta') {
        const name = $(elem).attr('name') || $(elem).attr('property') || '';
        if (
          !name.match(/^(title|description|keywords|og:|twitter:)/i) &&
          !$(elem).attr('charset')
        ) {
          const html = $.html(elem);
          if (html) otherMeta.push(html);
        }
      } else if (tag === 'link') {
        const rel = $(elem).attr('rel') || '';
        if (rel !== 'stylesheet' && rel !== 'canonical') {
          const html = $.html(elem);
          if (html) otherMeta.push(html);
        }
      }
    });

    console.log(`📦 Extracted from HTML: ${cssLinks.length} CSS links, ${scripts.length} scripts, ${inlineStyles.length} inline styles`);
    
    return { cssLinks, scripts, inlineStyles, otherMeta };
  } catch (error: any) {
    console.error('Error extracting head assets:', error.message);
    return { cssLinks: [], scripts: [], inlineStyles: [], otherMeta: [] };
  }
}

/**
 * Replace content in HTML using REGEX (preserves original formatting)
 * NO CHEERIO = preserves React JSX attributes like charSet
 */
export function replaceContentInHTML(
  html: string,
  aiContent: any,
  canonicalUrl: string,
  ogUrl: string
): string {
  if (!aiContent) {
    return html;
  }

  console.log('📝 Replacing content with REGEX (preserves original formatting)...');
  
  let modifiedHTML = html;

  try {
    // Replace title (between <title>...</title>)
    if (aiContent.title) {
      modifiedHTML = modifiedHTML.replace(
        /<title>.*?<\/title>/i,
        `<title>${aiContent.title}</title>`
      );
      
      // Replace og:title
      modifiedHTML = modifiedHTML.replace(
        /<meta\s+property="og:title"\s+content="[^"]*"/gi,
        `<meta property="og:title" content="${aiContent.title}"`
      );
      
      // Replace twitter:title
      modifiedHTML = modifiedHTML.replace(
        /<meta\s+name="twitter:title"\s+content="[^"]*"/gi,
        `<meta name="twitter:title" content="${aiContent.title}"`
      );
    }

    // Replace meta description
    if (aiContent.description?.meta) {
      modifiedHTML = modifiedHTML.replace(
        /<meta\s+name="description"\s+content="[^"]*"/gi,
        `<meta name="description" content="${aiContent.description.meta}"`
      );
      
      modifiedHTML = modifiedHTML.replace(
        /<meta\s+property="og:description"\s+content="[^"]*"/gi,
        `<meta property="og:description" content="${aiContent.description.meta}"`
      );
      
      modifiedHTML = modifiedHTML.replace(
        /<meta\s+name="twitter:description"\s+content="[^"]*"/gi,
        `<meta name="twitter:description" content="${aiContent.description.meta}"`
      );
    }

    // Replace keywords
    if (aiContent.keywords) {
      modifiedHTML = modifiedHTML.replace(
        /<meta\s+name="keywords"\s+content="[^"]*"/gi,
        `<meta name="keywords" content="${aiContent.keywords}"`
      );
    }

    // Replace canonical URL
    if (canonicalUrl) {
      modifiedHTML = modifiedHTML.replace(
        /<link\s+rel="canonical"\s+href="[^"]*"/gi,
        `<link rel="canonical" href="${canonicalUrl}"`
      );
    }

    // Replace OG URL
    if (ogUrl) {
      modifiedHTML = modifiedHTML.replace(
        /<meta\s+property="og:url"\s+content="[^"]*"/gi,
        `<meta property="og:url" content="${ogUrl}"`
      );
    }

    // Replace VideoObject JSON-LD schema (for consistency with meta tags)
    if (aiContent.title && aiContent.description?.meta) {
      // Escape special characters for JSON
      const escapedTitle = aiContent.title.replace(/"/g, '\\"').replace(/'/g, "\\'");
      const escapedDescription = aiContent.description.meta.replace(/"/g, '\\"').replace(/'/g, "\\'");
      
      // Replace VideoObject name
      modifiedHTML = modifiedHTML.replace(
        /"@type":"VideoObject","name":"[^"]*"/gi,
        `"@type":"VideoObject","name":"${escapedTitle}"`
      );
      
      // Replace VideoObject description (after name)
      modifiedHTML = modifiedHTML.replace(
        /("@type":"VideoObject","name":"[^"]*","description":")[^"]*(")/gi,
        `$1${escapedDescription}$2`
      );
      
      console.log(`✅ Updated VideoObject schema to match meta tags`);
    }

    console.log('✅ Content replaced (original formatting preserved)');
    return modifiedHTML;
  } catch (error: any) {
    console.error('Error replacing content:', error.message);
    return html;
  }
}

/**
 * Convert absolute URLs to relative URLs (like in contoh.html)
 * This makes the output match the format of a saved HTML file
 */
export function convertToRelativePaths(html: string): string {
  let modifiedHTML = html;
  
  console.log(`🔄 Converting absolute URLs to relative paths...`);
  
  // Convert Next.js static assets from CDN to relative paths
  // From: https://assets.cnsmedia.com/insightsbeta/_next/static/...
  // To:   /_next/static/...
  modifiedHTML = modifiedHTML.replace(
    /https:\/\/assets\.cnsmedia\.com\/insightsbeta\/_next\/static\//g,
    '/_next/static/'
  );
  
  // Also convert without 'insightsbeta' subdirectory
  modifiedHTML = modifiedHTML.replace(
    /https:\/\/assets\.cnsmedia\.com\/_next\/static\//g,
    '/_next/static/'
  );
  
  console.log(`✅ Converted CDN URLs to relative paths (like contoh.html)`);
  return modifiedHTML;
}

/**
 * Remove image preload tags (not present in contoh.html)
 * This matches the format of older Next.js output
 */
export function removeImagePreloads(html: string): string {
  console.log(`🗑️  Removing image preload tags...`);
  
  // Remove all <link rel="preload" as="image" .../> tags
  const modifiedHTML = html.replace(
    /<link\s+rel="preload"\s+as="image"[^>]*\/>\n?/gi,
    ''
  );
  
  console.log(`✅ Image preload tags removed (matching contoh.html format)`);
  return modifiedHTML;
}

/**
 * Remove menudiv and sticky navigation elements (not present in contoh.html)
 * Removes all navigation menu containers for cleaner AI-focused content
 */
export function removeMenuDiv(html: string): string {
  console.log(`🗑️  Removing menudiv and sticky navigation elements...`);
  
  let modifiedHTML = html;
  
  // Remove main menudiv container and all its contents
  modifiedHTML = modifiedHTML.replace(
    /<div\s+class="menudiv"[^>]*>[\s\S]*?<\/div>/gi,
    ''
  );
  
  // Remove all submenudiv elements
  modifiedHTML = modifiedHTML.replace(
    /<div\s+class="[^"]*submenudiv[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    ''
  );
  
  // Remove all sticky navigation elements (not in contoh.html)
  // This includes: menustickydiv, sticky-navbardiv, stickyheader-container, etc.
  modifiedHTML = modifiedHTML.replace(
    /<div\s+class="[^"]*sticky[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    ''
  );
  
  // Also remove any remaining sticky elements with other tags
  modifiedHTML = modifiedHTML.replace(
    /<[^>]+class="[^"]*sticky[^"]*"[^>]*>[\s\S]*?<\/[^>]+>/gi,
    ''
  );
  
  // Clean up any empty lines left behind
  modifiedHTML = modifiedHTML.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  console.log(`✅ menudiv & sticky elements removed (matching contoh.html)`);
  return modifiedHTML;
}

/**
 * Beautify HTML to match contoh.html format EXACTLY
 * Critical: <head><meta charSet.../> must be on SAME line
 */
export function beautifyHTML(html: string): string {
  console.log(`✨ Beautifying HTML to match contoh.html format...`);
  
  let formatted = html;
  
  // Step 1: Add newlines
  formatted = formatted
    .replace(/<!DOCTYPE html>/gi, '\n\n<!DOCTYPE html>\n')
    .replace(/(<html[^>]*>)/gi, '$1\n')
    // Every tag on new line EXCEPT we'll merge <head> with first meta later
    .replace(/><meta /gi, '>\n<meta ')
    .replace(/><link /gi, '>\n<link ')
    .replace(/><script/gi, '>\n<script')
    .replace(/<\/script></gi, '</script>\n<')
    .replace(/<\/head>/gi, '\n</head>\n')
    .replace(/<body/gi, '\n<body')
    .replace(/<\/body>/gi, '\n</body>\n')
    .replace(/<\/html>/gi, '\n</html>');
  
  // Step 2: MERGE <head> with first <meta charSet.../> on same line (like contoh.html line 5)
  formatted = formatted.replace(/<head>\n<meta charSet="utf-8"\/>/gi, '<head><meta charSet="utf-8"/>');
  
  // Step 3: Clean up multiple newlines
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  
  console.log(`✅ HTML beautified - <head> merged with first meta`);
  return formatted;
}

/**
 * Replace dates in HTML with today's date
 */
export function replaceDatesInHTML(html: string): string {
  const today = new Date();
  const todayISO = today.toISOString().split('T')[0]; // YYYY-MM-DD
  const todayISOFull = today.toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ
  const todayISOWithoutTZ = today.toISOString().replace(/\.\d{3}Z$/, '').replace(/Z$/, ''); // YYYY-MM-DDTHH:mm:ss (tanpa timezone)
  const todayDDMMMYYYY = today
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/ /g, ' '); // 07 Jan 2026
  const todayMMMDDYYYY = today
    .toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
    .replace(/ /g, ' '); // Jan 07, 2026

  let modifiedHTML = html;

  // 1. JSON-LD Schema Dates (tanpa timezone untuk selalu terlihat fresh)
  modifiedHTML = modifiedHTML.replace(
    /("uploadDate"|"datePublished"|"dateModified"|"dateCreated"):\s*"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d{3})?(Z|[+-]\d{2}:\d{2})?"/g,
    `$1: "${todayISOWithoutTZ}"`
  );

  // 2. Meta Tags Dates
  modifiedHTML = modifiedHTML.replace(
    /(<meta\s+(?:property|name)=["'](?:article:published_time|article:modified_time|date|pubdate|publishdate)["']\s+content=)["']\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2}))?["']/gi,
    `$1"${todayISO}"`
  );

  // 3. Content Text Dates
  // Regex for YYYY-MM-DD
  modifiedHTML = modifiedHTML.replace(
    /(?<!["'=\/])\b\d{4}-\d{2}-\d{2}\b(?![^<]*>|[^>]*<\/script)/g,
    todayISO
  );
  // Regex for DD MMM YYYY
  modifiedHTML = modifiedHTML.replace(
    /(?<!["'=\/])\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b(?![^<]*>|[^>]*<\/script)/gi,
    todayDDMMMYYYY
  );
  // Regex for MMM DD, YYYY
  modifiedHTML = modifiedHTML.replace(
    /(?<!["'=\/])\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}\b(?![^<]*>|[^>]*<\/script)/gi,
    todayMMMDDYYYY
  );
  // Regex for DD/MM/YYYY or MM/DD/YYYY
  modifiedHTML = modifiedHTML.replace(
    /(?<!["'=\/])\b\d{1,2}\/\d{1,2}\/\d{4}\b(?![^<]*>|[^>]*<\/script)/g,
    today.toLocaleDateString('en-GB')
  );

  return modifiedHTML;
}

/**
 * Generate HTML template with AI content
 */
export function generateHTMLTemplate(aiContent: any, requestPath: string, baseUrl: string): string {
  const title = aiContent?.title || 'Content';
  const metaDesc = aiContent?.description?.meta || '';
  const keywords = aiContent?.keywords || '';
  const paragraph = aiContent?.description?.paragraph || '';
  const canonicalUrl = `${baseUrl}${requestPath}`;
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
