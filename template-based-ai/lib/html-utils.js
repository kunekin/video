/**
 * HTML Utilities for template processing
 * Updated to match Next.js SSR processing exactly
 */

import * as cheerio from 'cheerio';

/**
 * Replace content in HTML with AI-generated content
 */
export function replaceContentInHTML(html, aiContent, canonicalUrl, ogUrl) {
  if (!aiContent) {
    return html;
  }

  let modifiedHTML = html;

  try {
    // Replace title
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

    // Replace keywords (handle both old string format and new object format)
    if (aiContent.keywords) {
      let keywordsString;
      if (typeof aiContent.keywords === 'string') {
        // Old format: comma-separated string
        keywordsString = aiContent.keywords;
      } else if (typeof aiContent.keywords === 'object') {
        // New format: object with primary, lsi, longTail, questions
        const allKeywords = [
          aiContent.keywords.primary,
          ...(aiContent.keywords.lsi || []),
          ...(aiContent.keywords.longTail || []),
          ...(aiContent.keywords.questions || [])
        ].filter(Boolean); // Remove any undefined/null values
        keywordsString = allKeywords.join(', ');
      }
      
      if (keywordsString) {
        modifiedHTML = modifiedHTML.replace(
          /<meta\s+name="keywords"\s+content="[^"]*"/gi,
          `<meta name="keywords" content="${keywordsString}"`
        );
      }
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

    // Replace VideoObject JSON-LD schema
    if (aiContent.title && aiContent.description?.meta) {
      const escapedTitle = aiContent.title.replace(/"/g, '\\"').replace(/'/g, "\\'");
      const escapedDescription = aiContent.description.meta.replace(/"/g, '\\"').replace(/'/g, "\\'");
      
      // Replace VideoObject name
      modifiedHTML = modifiedHTML.replace(
        /"@type":"VideoObject","name":"[^"]*"/gi,
        `"@type":"VideoObject","name":"${escapedTitle}"`
      );
      
      // Replace VideoObject description
      modifiedHTML = modifiedHTML.replace(
        /("@type":"VideoObject","name":"[^"]*","description":")[^"]*(")/gi,
        `$1${escapedDescription}$2`
      );
    }

    // Replace videotitletext (visible title in body) with extended title
    if (aiContent.extendedTitle) {
      modifiedHTML = modifiedHTML.replace(
        /(<p class="videotitletext">)[^<]*(<\/p>)/gi,
        `$1${aiContent.extendedTitle}$2`
      );
      console.log('✅ Replaced videotitletext with extended AI title');
    }

    // Replace cursordefault (breadcrumb title) with regular AI title
    if (aiContent.title) {
      modifiedHTML = modifiedHTML.replace(
        /(<span class="cursordefault">)[^<]*(<\/span>)/gi,
        `$1${aiContent.title}$2`
      );
      console.log('✅ Replaced cursordefault breadcrumb with AI title');
    }

    // Replace BreadcrumbList position 3 name with AI title
    if (aiContent.title) {
      const escapedTitle = aiContent.title.replace(/"/g, '\\"').replace(/'/g, "\\'");
      modifiedHTML = modifiedHTML.replace(
        /("@type":"ListItem","position":3,"name":")[^"]*(")/gi,
        `$1${escapedTitle}$2`
      );
      console.log('✅ Replaced BreadcrumbList position 3 with AI title');
    }

    // Replace videocontenttext videosum (video description) with AI paragraph
    // Use snippet if available (featured snippet optimized), fallback to paragraph
    const videoDescription = aiContent.description?.snippet || aiContent.description?.paragraph;
    if (videoDescription) {
      modifiedHTML = modifiedHTML.replace(
        /(<div class="videocontenttext videosum"[^>]*>.*?<p>)[^<]*(<\/p>)/gis,
        `$1${videoDescription}$2`
      );
      console.log(`✅ Replaced video description with AI ${aiContent.description?.snippet ? 'snippet' : 'paragraph'}`);
    }

    console.log('✅ Content replaced in template');
    return modifiedHTML;
  } catch (error) {
    console.error('❌ Error replacing content:', error.message);
    return html;
  }
}

/**
 * Replace dates in HTML with today's date
 */
export function replaceDatesInHTML(html) {
  const today = new Date();
  const todayISO = today.toISOString().split('T')[0]; // YYYY-MM-DD
  const todayISOFull = today.toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ
  const todayDDMMMYYYY = today
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/ /g, ' ');

  let modifiedHTML = html;

  // Replace JSON-LD Schema Dates
  modifiedHTML = modifiedHTML.replace(
    /("uploadDate"|"datePublished"|"dateModified"|"dateCreated"):\s*"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2}))"/g,
    `$1: "${todayISOFull}"`
  );

  // Replace Meta Tags Dates
  modifiedHTML = modifiedHTML.replace(
    /(<meta\s+(?:property|name)=["'](?:article:published_time|article:modified_time|date|pubdate|publishdate)["']\s+content=)["']\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2}))?["']/gi,
    `$1"${todayISO}"`
  );

  // Replace content text dates - YYYY-MM-DD format
  modifiedHTML = modifiedHTML.replace(
    /(?<!["'=\/])\b\d{4}-\d{2}-\d{2}\b(?![^<]*>|[^>]*<\/script)/g,
    todayISO
  );

  // Replace content text dates - "DD MMM YYYY" format (e.g., "09 Jan 2026")
  modifiedHTML = modifiedHTML.replace(
    /\b\d{2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b/gi,
    todayDDMMMYYYY
  );

  console.log('✅ Dates updated to today');
  return modifiedHTML;
}

/**
 * Convert absolute URLs to relative paths
 */
export function convertToRelativePaths(html) {
  let modifiedHtml = html;

  const regex = /(href|src)="((https?:\/\/(?:assets\.cnsmedia\.com\/insightsbeta|www\.packaginginsights\.com))(\/[^"]*))"/gi;

  modifiedHtml = modifiedHtml.replace(regex, (_match, attr, _fullUrl, _domain, path) => {
    return `${attr}="${path}"`;
  });

  console.log('✅ Converted URLs to relative paths');
  return modifiedHtml;
}

/**
 * Remove Next.js specific scripts and preload links
 */
export function removeNextJsScripts(html) {
  let modifiedHtml = html;
  
  // Filter out external Next.js scripts
  modifiedHtml = modifiedHtml.replace(
    /<script[^>]*src="https:\/\/assets\.cnsmedia\.com\/[^"]*\/_next\/static\/[^"]*"[^>]*><\/script>/gi,
    '<!-- External Next.js script filtered -->'
  );
  
  // Filter out inline Next.js scripts
  modifiedHtml = modifiedHtml.replace(
    /<script[^>]*>(?=.*(?:self\.__next_s|self\.__next_f))[\s\S]*?<\/script>/gi,
    '<!-- Inline Next.js script filtered -->'
  );
  
  // Filter out Next.js script tags with /_next/ in src
  modifiedHtml = modifiedHtml.replace(
    /<script[^>]*src="[^"]*\/_next\/[^"]*"[^>]*><\/script>/gi,
    '<!-- Next.js script filtered -->'
  );
  
  // Filter out Next.js preload links
  modifiedHtml = modifiedHtml.replace(
    /<link[^>]*rel="preload"[^>]*href="[^"]*\/_next\/[^"]*"[^>]*>/gi,
    '<!-- Next.js preload filtered -->'
  );
  
  // Filter out Next.js stylesheet links
  modifiedHtml = modifiedHtml.replace(
    /<link[^>]*rel="stylesheet"[^>]*href="[^"]*\/_next\/[^"]*"[^>]*>/gi,
    '<!-- Next.js stylesheet filtered -->'
  );
  
  console.log('✅ Next.js scripts and preload links removed');
  return modifiedHtml;
}

/**
 * Remove image preload tags
 */
export function removeImagePreloadTags(html) {
  const result = html.replace(/<link rel="preload" as="image"[^>]*>/gi, '');
  console.log('✅ Image preload tags removed');
  return result;
}

/**
 * Remove navigation elements using Cheerio (like Next.js SSR)
 */
export function removeNavigationElements(html) {
  const $ = cheerio.load(html);
  
  // Remove main menudiv
  $('.menudiv').remove();
  
  // Remove all submenudivs
  $('[class*="submenudiv"]').remove();
  
  // Remove all sticky navigation elements
  $('[class*="sticky"]').remove();
  
  console.log('✅ Navigation elements removed');
  return $.html();
}

/**
 * Beautify HTML (optional, for readability)
 */
export function beautifyHTML(html) {
  let formattedHtml = html;

  // Ensure <head><meta charSet="utf-8"/> is on one line
  formattedHtml = formattedHtml.replace(/<head>\s*<meta charSet="/i, '<head><meta charSet="');

  // Add line breaks after specific closing tags in the head
  formattedHtml = formattedHtml.replace(/(<\/meta>|<\/link>|<\/script>)/gi, '$1\n');

  // Add line break after </head>
  formattedHtml = formattedHtml.replace(/<\/head>/i, '</head>\n');

  // Add line break after <body>
  formattedHtml = formattedHtml.replace(/<body>/i, '<body>\n');

  // Add line break before </body>
  formattedHtml = formattedHtml.replace(/<\/body>/i, '\n</body>');

  // Add line break before </html>
  formattedHtml = formattedHtml.replace(/<\/html>/i, '\n</html>');

  // Remove multiple blank lines
  formattedHtml = formattedHtml.replace(/\n\s*\n/g, '\n');

  return formattedHtml;
}

/**
 * Replace 6 related videos with AI-generated titles and descriptions.
 * Removes href attributes to prevent dead links.
 */
export function replaceRelatedVideos(html, aiContent) {
  if (!aiContent.relatedVideos || aiContent.relatedVideos.length !== 6) {
    console.log('⚠️  No related videos in AI content, skipping...');
    return html;
  }
  
  const $ = cheerio.load(html);
  
  // Find all video links in morecontentdiv
  const moreContentDiv = $('.morecontentdiv');
  if (moreContentDiv.length === 0) {
    console.log('⚠️  No morecontentdiv found, skipping related videos replacement');
    return html;
  }
  
  // Find all video link containers
  const videoLinks = moreContentDiv.find('a');
  
  let replacedCount = 0;
  videoLinks.each((index, element) => {
    if (index < 6 && aiContent.relatedVideos[index]) {
      const video = aiContent.relatedVideos[index];
      
      // Replace title
      const titleElement = $(element).find('.morevideotitle');
      if (titleElement.length > 0) {
        titleElement.text(video.title);
      }
      
      // Replace description/content
      const contentElement = $(element).find('.morevideocontent, p:not(.morevideotitle)').first();
      if (contentElement.length > 0) {
        contentElement.text(video.description);
      }
      
      // Replace duration
      const timeElement = $(element).find('.videotime');
      if (timeElement.length > 0) {
        timeElement.text(video.duration);
      }
      
      // REMOVE href to prevent dead links
      $(element).removeAttr('href');
      $(element).css({
        'cursor': 'default',
        'text-decoration': 'none',
        'pointer-events': 'none'
      });
      
      replacedCount++;
    }
  });
  
  console.log(`✅ Replaced ${replacedCount} related videos with AI content`);
  return $.html();
}

