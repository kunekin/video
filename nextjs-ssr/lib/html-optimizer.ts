/**
 * HTML Optimizer
 * Optimize scraped HTML for better performance and SEO
 */

const cheerio = require('cheerio');

interface OptimizationOptions {
  removeComments?: boolean;
  removeTrackingScripts?: boolean;
  removeAds?: boolean;
  minifyWhitespace?: boolean;
  lazyLoadImages?: boolean;
  removeUnusedCSS?: boolean;
  keepOnlyFirstNCSS?: number; // Keep only first N CSS files
  removeInlineStyles?: boolean;
  removeUnnecessaryMeta?: boolean;
  removeNavigationElements?: boolean; // Remove headers, footers, navbars
  customRemoveSelectors?: string[]; // Custom CSS selectors to remove
}

const DEFAULT_OPTIONS: OptimizationOptions = {
  removeComments: true,
  removeTrackingScripts: true,
  removeAds: true,
  minifyWhitespace: true,
  lazyLoadImages: true,
  removeUnusedCSS: false,
  keepOnlyFirstNCSS: 3, // Keep only first 3 CSS files (usually most important)
  removeInlineStyles: false,
  removeUnnecessaryMeta: true,
  removeNavigationElements: false,
  customRemoveSelectors: [],
};

/**
 * List of tracking/analytics domains to remove
 */
const TRACKING_DOMAINS = [
  'google-analytics.com',
  'googletagmanager.com',
  'facebook.com/tr',
  'facebook.net',
  'doubleclick.net',
  'hotjar.com',
  'mouseflow.com',
  'crazyegg.com',
  'analytics',
  'tracking',
  'gtag',
  'fbevents',
  'pixel',
];

/**
 * List of ad-related selectors to remove
 */
const AD_SELECTORS = [
  '[class*="ad-"]',
  '[class*="ads-"]',
  '[id*="ad-"]',
  '[id*="ads-"]',
  '.advertisement',
  '.ad-container',
  '.google-ad',
  'ins.adsbygoogle',
];

/**
 * Optimize HTML for better performance and SEO
 */
export function optimizeHTML(html: string, options: OptimizationOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  try {
    let optimizedHTML = html;
    
    // Remove HTML comments
    if (opts.removeComments) {
      optimizedHTML = optimizedHTML.replace(/<!--[\s\S]*?-->/g, '');
      console.log('✂️  Removed HTML comments');
    }
    
    // Remove tracking scripts
    if (opts.removeTrackingScripts) {
      optimizedHTML = removeTrackingScripts(optimizedHTML);
    }
    
    // Remove ads
    if (opts.removeAds) {
      optimizedHTML = removeAds(optimizedHTML);
    }
    
    // Optimize with cheerio
    const $ = cheerio.load(optimizedHTML);
    
    // Remove navigation elements
    if (opts.removeNavigationElements) {
      removeNavigationElements($);
    }
    
    // Remove custom selectors
    if (opts.customRemoveSelectors && opts.customRemoveSelectors.length > 0) {
      removeCustomSelectors($, opts.customRemoveSelectors);
    }
    
    // Remove unnecessary meta tags
    if (opts.removeUnnecessaryMeta) {
      removeUnnecessaryMeta($);
    }
    
    // Lazy load images
    if (opts.lazyLoadImages) {
      lazyLoadImages($);
    }
    
    // Keep only first N CSS files
    if (opts.keepOnlyFirstNCSS && opts.keepOnlyFirstNCSS > 0) {
      keepOnlyFirstNCSS($, opts.keepOnlyFirstNCSS);
    }
    
    // Remove inline styles if requested
    if (opts.removeInlineStyles) {
      $('style').remove();
      $('[style]').removeAttr('style');
      console.log('✂️  Removed inline styles');
    }
    
    optimizedHTML = $.html();
    
    // Minify whitespace
    if (opts.minifyWhitespace) {
      optimizedHTML = minifyWhitespace(optimizedHTML);
    }
    
    const originalSize = html.length;
    const optimizedSize = optimizedHTML.length;
    const savedBytes = originalSize - optimizedSize;
    const savedPercent = ((savedBytes / originalSize) * 100).toFixed(1);
    
    console.log(`✅ HTML optimized: ${originalSize} → ${optimizedSize} bytes (saved ${savedPercent}%)`);
    
    return optimizedHTML;
  } catch (error: any) {
    console.error('❌ Error optimizing HTML:', error.message);
    return html;
  }
}

/**
 * Remove tracking and analytics scripts
 */
function removeTrackingScripts(html: string): string {
  const $ = cheerio.load(html);
  let removed = 0;
  
  $('script').each((_, elem) => {
    const src = $(elem).attr('src') || '';
    const content = $(elem).html() || '';
    
    // Check if script contains tracking domains
    const isTracking = TRACKING_DOMAINS.some(domain => 
      src.includes(domain) || content.includes(domain)
    );
    
    if (isTracking) {
      $(elem).remove();
      removed++;
    }
  });
  
  if (removed > 0) {
    console.log(`✂️  Removed ${removed} tracking scripts`);
  }
  
  return $.html();
}

/**
 * Remove ad elements
 */
function removeAds(html: string): string {
  const $ = cheerio.load(html);
  let removed = 0;
  
  AD_SELECTORS.forEach(selector => {
    const elements = $(selector);
    removed += elements.length;
    elements.remove();
  });
  
  if (removed > 0) {
    console.log(`✂️  Removed ${removed} ad elements`);
  }
  
  return $.html();
}

/**
 * Remove unnecessary meta tags (keep only SEO-critical ones)
 */
function removeUnnecessaryMeta($: any): void {
  let removed = 0;
  
  $('meta').each((_, elem) => {
    const name = $(elem).attr('name') || '';
    const property = $(elem).attr('property') || '';
    const httpEquiv = $(elem).attr('http-equiv') || '';
    
    // Keep SEO-critical meta tags
    const isCritical = 
      name.match(/^(description|keywords|author|robots|viewport)$/i) ||
      property.match(/^(og:|twitter:|article:)/i) ||
      httpEquiv.match(/^(content-type|content-language)$/i) ||
      $(elem).attr('charset');
    
    if (!isCritical && (name || property || httpEquiv)) {
      $(elem).remove();
      removed++;
    }
  });
  
  if (removed > 0) {
    console.log(`✂️  Removed ${removed} unnecessary meta tags`);
  }
}

/**
 * Add lazy loading to images
 */
function lazyLoadImages($: any): void {
  let optimized = 0;
  
  $('img').each((_, elem) => {
    // Add loading="lazy" attribute
    if (!$(elem).attr('loading')) {
      $(elem).attr('loading', 'lazy');
      optimized++;
    }
    
    // Add decoding="async" for better performance
    if (!$(elem).attr('decoding')) {
      $(elem).attr('decoding', 'async');
    }
  });
  
  if (optimized > 0) {
    console.log(`⚡ Added lazy loading to ${optimized} images`);
  }
}

/**
 * Keep only first N CSS files (usually most important)
 * If keepCount is 0, remove all CSS
 */
function keepOnlyFirstNCSS($: any, keepCount: number): void {
  const cssLinks = $('link[rel="stylesheet"]');
  const totalCSS = cssLinks.length;
  
  if (keepCount === 0) {
    // Remove ALL CSS
    cssLinks.remove();
    console.log(`✂️  Removed ALL ${totalCSS} CSS files (SEO-only mode)`);
  } else if (totalCSS > keepCount) {
    cssLinks.slice(keepCount).remove();
    console.log(`✂️  Kept only first ${keepCount} CSS files (removed ${totalCSS - keepCount})`);
  }
}

/**
 * Hide navigation elements using CSS <style> tag (not remove, just hide)
 */
function removeNavigationElements($: any): void {
  // Selectors to hide
  const navSelectors = [
    'header',
    'footer',
    'nav',
    '.header',
    '.footer',
    '.navigation',
    '.navbar',
    '.menu',
    '.sticky-header',
    '.stickyheader-container',
    '.header-container',
    '#header',
    '#footer',
    '#navigation',
    '#backgroundbanner',
    '.headercentercontainer',
    '.middleheader',
    '.searchboxdiv',
    '.subscribebtndiv',
    '.bredgrumsdiv',
    '.shareiconbtndiv',
    '.morecontainer',
    '.footerheadtitle',
    '.bellicon',
    '.footer-content',
    '.top_link',
    '[class*="sticky"]',
    '[class*="header"]',
    '[class*="footer"]',
    '[class*="nav"]',
    '[class*="menu"]',
  ];
  
  // Count elements to hide
  let hiddenCount = 0;
  navSelectors.forEach(selector => {
    hiddenCount += $(selector).length;
  });
  
  if (hiddenCount > 0) {
    // Create CSS to hide all navigation elements
    const hideCSS = navSelectors.map(selector => `${selector} { display: none !important; }`).join('\n');
    
    // Inject style tag at beginning of head
    const styleTag = `<style id="hide-navigation">\n${hideCSS}\n</style>`;
    
    if ($('head').length > 0) {
      $('head').prepend(styleTag);
    } else {
      // If no head, create one
      $('html').prepend(`<head>${styleTag}</head>`);
    }
    
    console.log(`👁️  Hidden ${hiddenCount} navigation elements (using <style> tag)`);
  }
}

/**
 * Remove custom CSS selectors
 */
function removeCustomSelectors($: any, selectors: string[]): void {
  let removed = 0;
  
  selectors.forEach(selector => {
    const elements = $(selector);
    removed += elements.length;
    elements.remove();
  });
  
  if (removed > 0) {
    console.log(`🎯 Removed ${removed} custom elements`);
  }
}

/**
 * Minify whitespace
 */
function minifyWhitespace(html: string): string {
  return html
    // Remove whitespace between tags
    .replace(/>\s+</g, '><')
    // Remove multiple spaces
    .replace(/\s{2,}/g, ' ')
    // Remove leading/trailing whitespace in lines
    .replace(/^\s+|\s+$/gm, '')
    // Remove empty lines
    .replace(/\n\s*\n/g, '\n');
}

/**
 * Get optimization statistics
 */
export function getOptimizationStats(originalHTML: string, optimizedHTML: string): {
  originalSize: number;
  optimizedSize: number;
  savedBytes: number;
  savedPercent: string;
  compressionRatio: string;
} {
  const originalSize = originalHTML.length;
  const optimizedSize = optimizedHTML.length;
  const savedBytes = originalSize - optimizedSize;
  const savedPercent = ((savedBytes / originalSize) * 100).toFixed(1);
  const compressionRatio = (optimizedSize / originalSize).toFixed(3);
  
  return {
    originalSize,
    optimizedSize,
    savedBytes,
    savedPercent,
    compressionRatio,
  };
}

