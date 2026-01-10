// Test scraping functionality
const cheerio = require('cheerio');

async function testScraping() {
  console.log('🧪 Testing scraping...\n');
  
  const url = 'https://www.packaginginsights.com/video/drinktec-2025-sidel-debuts-laser-blowing.html';
  
  try {
    console.log(`📥 Fetching: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      }
    });
    
    console.log(`📊 Status: ${response.status}`);
    
    if (!response.ok) {
      console.error(`❌ Failed: ${response.statusText}`);
      return;
    }
    
    const html = await response.text();
    console.log(`📄 HTML length: ${html.length} bytes`);
    
    // Test cheerio extraction
    const $ = cheerio.load(html);
    
    const cssLinks = [];
    $('head link[rel="stylesheet"]').each((_, elem) => {
      const href = $(elem).attr('href');
      if (href) {
        cssLinks.push({ href, rel: 'stylesheet' });
      }
    });
    
    const inlineStyles = [];
    $('head style').each((_, elem) => {
      const content = $(elem).html();
      if (content) {
        inlineStyles.push(content);
      }
    });
    
    console.log(`\n✅ Extraction results:`);
    console.log(`   CSS Links: ${cssLinks.length}`);
    console.log(`   Inline Styles: ${inlineStyles.length}`);
    
    if (cssLinks.length > 0) {
      console.log(`\n📋 First 3 CSS links:`);
      cssLinks.slice(0, 3).forEach((link, i) => {
        console.log(`   ${i + 1}. ${link.href}`);
      });
    }
    
    if (inlineStyles.length > 0) {
      console.log(`\n📋 Inline styles (first 100 chars):`);
      console.log(`   ${inlineStyles[0].substring(0, 100)}...`);
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
  }
}

testScraping();

