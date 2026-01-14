/**
 * HTML Beautifier
 * Clean and structure HTML while preserving SEO and functionality
 */

const cheerio = require('cheerio');

interface BeautifyOptions {
  cleanStructure?: boolean;
  removeDuplicates?: boolean;
  organizeHeadings?: boolean;
  addSemantic?: boolean;
  formatWhitespace?: boolean;
  addComments?: boolean;
}

const DEFAULT_OPTIONS: BeautifyOptions = {
  cleanStructure: true,
  removeDuplicates: true,
  organizeHeadings: true,
  addSemantic: true,
  formatWhitespace: true,
  addComments: false,
};

/**
 * Beautify HTML - make it clean and well-structured
 */
export function beautifyHTML(html: string, options: BeautifyOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  try {
    const $ = cheerio.load(html);
    
    // Clean structure
    if (opts.cleanStructure) {
      cleanHTMLStructure($);
    }
    
    // Remove duplicate elements
    if (opts.removeDuplicates) {
      removeDuplicateElements($);
    }
    
    // Organize headings hierarchy
    if (opts.organizeHeadings) {
      organizeHeadingHierarchy($);
    }
    
    // Add semantic HTML5 tags
    if (opts.addSemantic) {
      addSemanticTags($);
    }
    
    let beautifiedHTML = $.html();
    
    // Format whitespace for readability
    if (opts.formatWhitespace) {
      beautifiedHTML = formatHTMLWhitespace(beautifiedHTML);
    }
    
    // Add helpful comments
    if (opts.addComments) {
      beautifiedHTML = addStructureComments(beautifiedHTML);
    }
    
    console.log(`✨ HTML beautified and structured`);
    
    return beautifiedHTML;
  } catch (error: any) {
    console.error('❌ Error beautifying HTML:', error.message);
    return html;
  }
}

/**
 * Clean HTML structure - remove empty/broken elements
 */
function cleanHTMLStructure($: any): void {
  let cleaned = 0;
  
  // Remove empty paragraphs
  $('p:empty, div:empty:not([class]):not([id])').each((_, elem) => {
    $(elem).remove();
    cleaned++;
  });
  
  // Remove broken images (no src)
  $('img:not([src])').each((_, elem) => {
    $(elem).remove();
    cleaned++;
  });
  
  // Remove empty links
  $('a:empty:not([name]):not([id])').each((_, elem) => {
    $(elem).remove();
    cleaned++;
  });
  
  // Clean up nested divs (div > div with same class)
  $('div > div').each((_, elem) => {
    const parent = $(elem).parent();
    const child = $(elem);
    
    if (parent.children().length === 1 && 
        !parent.attr('class') && 
        !child.attr('class')) {
      parent.replaceWith(child);
      cleaned++;
    }
  });
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} empty/broken elements`);
  }
}

/**
 * Remove duplicate meta tags and elements
 */
function removeDuplicateElements($: any): void {
  let removed = 0;
  
  // Track seen meta tags
  const seenMeta: Set<string> = new Set();
  
  $('meta').each((_, elem) => {
    const name = $(elem).attr('name') || $(elem).attr('property') || '';
    const content = $(elem).attr('content') || '';
    const key = `${name}:${content}`;
    
    if (name && seenMeta.has(key)) {
      $(elem).remove();
      removed++;
    } else if (name) {
      seenMeta.add(key);
    }
  });
  
  // Remove duplicate canonical links
  const canonicals = $('link[rel="canonical"]');
  if (canonicals.length > 1) {
    canonicals.slice(1).remove();
    removed += canonicals.length - 1;
  }
  
  if (removed > 0) {
    console.log(`🔄 Removed ${removed} duplicate elements`);
  }
}

/**
 * Organize heading hierarchy (ensure proper H1 > H2 > H3 order)
 */
function organizeHeadingHierarchy($: any): void {
  let fixed = 0;
  
  // Ensure only one H1
  const h1s = $('h1');
  if (h1s.length > 1) {
    console.log(`⚠️  Found ${h1s.length} H1 tags, keeping first one`);
    h1s.slice(1).each((_, elem) => {
      const h2 = $('<h2>').html($(elem).html()).attr('class', $(elem).attr('class'));
      $(elem).replaceWith(h2);
      fixed++;
    });
  }
  
  // Wrap headings in proper structure
  let currentLevel = 0;
  $('h1, h2, h3, h4, h5, h6').each((_, elem) => {
    const level = parseInt($(elem).prop('tagName').substring(1));
    
    // Skip if heading jumps too many levels (e.g., H1 to H4)
    if (currentLevel > 0 && level > currentLevel + 1) {
      const correctTag = `h${currentLevel + 1}`;
      const newElem = $(`<${correctTag}>`).html($(elem).html()).attr('class', $(elem).attr('class'));
      $(elem).replaceWith(newElem);
      fixed++;
    }
    
    currentLevel = level;
  });
  
  if (fixed > 0) {
    console.log(`📝 Fixed ${fixed} heading hierarchy issues`);
  }
}

/**
 * Add semantic HTML5 tags for better structure
 */
function addSemanticTags($: any): void {
  let added = 0;
  
  // Wrap main content in <main> if not already
  if ($('main').length === 0) {
    const bodyChildren = $('body').children();
    if (bodyChildren.length > 0) {
      const main = $('<main>');
      bodyChildren.each((_, elem) => {
        // Don't wrap header, footer, nav
        const tag = $(elem).prop('tagName')?.toLowerCase();
        if (tag !== 'header' && tag !== 'footer' && tag !== 'nav') {
          main.append($(elem).clone());
          $(elem).remove();
        }
      });
      
      if (main.children().length > 0) {
        $('body').append(main);
        added++;
      }
    }
  }
  
  // Wrap article content in <article>
  if ($('article').length === 0 && $('main').length > 0) {
    const main = $('main');
    const hasH1 = main.find('h1').length > 0;
    const hasP = main.find('p').length > 0;
    
    if (hasH1 && hasP) {
      const article = $('<article>');
      main.children().each((_, elem) => {
        article.append($(elem).clone());
        $(elem).remove();
      });
      main.append(article);
      added++;
    }
  }
  
  // Add section tags for content groups
  if ($('section').length === 0 && $('article').length > 0) {
    const article = $('article');
    let currentSection: any = null;
    
    article.children().each((_, elem) => {
      const tag = $(elem).prop('tagName')?.toLowerCase();
      
      // Start new section on H2
      if (tag === 'h2') {
        if (currentSection) {
          article.append(currentSection);
        }
        currentSection = $('<section>');
        currentSection.append($(elem).clone());
        $(elem).remove();
      } else if (currentSection) {
        currentSection.append($(elem).clone());
        $(elem).remove();
      }
    });
    
    // Append last section
    if (currentSection && currentSection.children().length > 0) {
      article.append(currentSection);
      added++;
    }
  }
  
  if (added > 0) {
    console.log(`🏗️  Added ${added} semantic HTML5 tags`);
  }
}

/**
 * Format HTML whitespace for better readability
 */
function formatHTMLWhitespace(html: string): string {
  return html
    // Add newline after opening tags
    .replace(/(<(?:div|main|article|section|header|footer|nav)[^>]*>)/g, '$1\n  ')
    // Add newline before closing tags
    .replace(/(<\/(?:div|main|article|section|header|footer|nav)>)/g, '\n$1')
    // Add newline after headings
    .replace(/(<\/h[1-6]>)/g, '$1\n')
    // Add newline after paragraphs
    .replace(/(<\/p>)/g, '$1\n')
    // Clean multiple newlines
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * Add structure comments for clarity
 */
function addStructureComments(html: string): string {
  return html
    .replace(/<main[^>]*>/, '<!-- Main Content Start -->\n<main>')
    .replace(/<\/main>/, '</main>\n<!-- Main Content End -->')
    .replace(/<article[^>]*>/, '<!-- Article Start -->\n<article>')
    .replace(/<\/article>/, '</article>\n<!-- Article End -->')
    .replace(/<section[^>]*>/g, '<!-- Section Start -->\n<section>')
    .replace(/<\/section>/g, '</section>\n<!-- Section End -->');
}

/**
 * Get beautification statistics
 */
export function getBeautifyStats(originalHTML: string, beautifiedHTML: string): {
  originalLines: number;
  beautifiedLines: number;
  structureImproved: boolean;
} {
  const originalLines = originalHTML.split('\n').length;
  const beautifiedLines = beautifiedHTML.split('\n').length;
  const structureImproved = beautifiedHTML.includes('<main>') || 
                            beautifiedHTML.includes('<article>') ||
                            beautifiedHTML.includes('<section>');
  
  return {
    originalLines,
    beautifiedLines,
    structureImproved,
  };
}

/**
 * Validate HTML structure
 */
export function validateHTMLStructure(html: string): {
  hasH1: boolean;
  hasMetaDescription: boolean;
  hasCanonical: boolean;
  hasMain: boolean;
  hasArticle: boolean;
  headingHierarchyValid: boolean;
} {
  const $ = cheerio.load(html);
  
  const h1Count = $('h1').length;
  const hasMetaDescription = $('meta[name="description"]').length > 0;
  const hasCanonical = $('link[rel="canonical"]').length > 0;
  const hasMain = $('main').length > 0;
  const hasArticle = $('article').length > 0;
  
  // Check heading hierarchy
  let headingHierarchyValid = true;
  let prevLevel = 0;
  $('h1, h2, h3, h4, h5, h6').each((_, elem) => {
    const level = parseInt($(elem).prop('tagName').substring(1));
    if (prevLevel > 0 && level > prevLevel + 1) {
      headingHierarchyValid = false;
    }
    prevLevel = level;
  });
  
  return {
    hasH1: h1Count === 1, // Should have exactly 1 H1
    hasMetaDescription,
    hasCanonical,
    hasMain,
    hasArticle,
    headingHierarchyValid,
  };
}

