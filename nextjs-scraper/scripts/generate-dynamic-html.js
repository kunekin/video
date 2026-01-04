const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const { execSync } = require('child_process');
const crypto = require('crypto');

// Function to extract chunks from Next.js build output
function extractChunksFromBuild() {
  const buildDir = path.join(__dirname, '../.next');
  const buildManifestPath = path.join(buildDir, 'build-manifest.json');
  
  if (!fs.existsSync(buildDir)) {
    console.log('⚠️  .next directory not found. Running Next.js build...');
    try {
      const projectDir = path.resolve(__dirname, '..');
      console.log(`Building in: ${projectDir}`);
      execSync('npm run build', { 
        cwd: projectDir, 
        stdio: 'inherit',
        env: { ...process.env, PWD: projectDir }
      });
    } catch (error) {
      console.error('❌ Build failed:', error.message);
      console.log('💡 Tip: Run "npm run build" manually in nextjs-scraper directory first');
      return { css: [], js: [], polyfills: null, webpack: null };
    }
  }

  try {
    // Extract CSS files from .next/static/css directory
    const cssFiles = [];
    const cssDir = path.join(buildDir, 'static/css');
    if (fs.existsSync(cssDir)) {
      const files = fs.readdirSync(cssDir, { recursive: true });
      files.forEach(file => {
        if (file.endsWith('.css')) {
          // Keep full path relative to static/css (e.g., "app/layout" or just "layout")
          const cssName = file.replace(/\.css$/, '');
          if (cssName && !cssFiles.includes(cssName)) {
            cssFiles.push(cssName);
          }
        }
      });
    }

    // Extract JS files from chunks directory
    const jsFiles = [];
    let polyfillsChunk = null;
    let webpackChunk = null;
    const chunksDir = path.join(buildDir, 'static/chunks');
    if (fs.existsSync(chunksDir)) {
      const files = fs.readdirSync(chunksDir, { recursive: true });
      files.forEach(file => {
        if (file.endsWith('.js')) {
          const fileName = file.replace(/\\/g, '/'); // Normalize path separators
          if (fileName.includes('polyfills')) {
            // Extract polyfills chunk name (remove .js extension)
            polyfillsChunk = fileName.replace(/\.js$/, '');
          } else if (fileName.includes('webpack')) {
            // Extract webpack chunk name (remove .js extension)
            webpackChunk = fileName.replace(/\.js$/, '');
          } else if (
            !file.includes('main-app') &&
            !file.includes('framework') &&
            !file.includes('app-pages-internals')) {
            // Keep full path (e.g., "app/layout.js" or "components-ShareButtons.js")
            jsFiles.push(file);
          }
        }
      });
    }

    return { css: cssFiles, js: jsFiles, polyfills: polyfillsChunk, webpack: webpackChunk };
  } catch (error) {
    console.error('❌ Error reading build output:', error.message);
    return { css: [], js: [], polyfills: null, webpack: null };
  }
}

// Alternative: Extract from actual HTML output
function extractChunksFromHTML(htmlPath) {
  try {
    const html = fs.readFileSync(htmlPath, 'utf-8');
    const $ = cheerio.load(html);
    
    const cssChunks = [];
    $('link[rel="stylesheet"][href*="/_next/static/css/"]').each((i, el) => {
      const href = $(el).attr('href');
      const match = href.match(/\/_next\/static\/css\/([^.]+)\.css/);
      if (match) {
        cssChunks.push(match[1]);
      }
    });

    const jsChunks = [];
    let polyfillsChunk = null;
    let webpackChunk = null;
    $('script[src*="/_next/static/chunks/"]').each((i, el) => {
      const src = $(el).attr('src');
      const match = src.match(/\/_next\/static\/chunks\/(.+?)\.js/);
      if (match) {
        const chunkName = match[1];
        if (chunkName.includes('polyfills')) {
          polyfillsChunk = chunkName;
        } else if (chunkName.includes('webpack')) {
          webpackChunk = chunkName;
        } else {
          jsChunks.push(chunkName);
        }
      }
    });

    return { css: cssChunks, js: jsChunks, polyfills: polyfillsChunk, webpack: webpackChunk };
  } catch (error) {
    console.error('❌ Error reading HTML:', error.message);
    return { css: [], js: [], polyfills: null, webpack: null };
  }
}

// Extract encrypted ID from video URL
function extractEncryptedId(videoUrl) {
  if (!videoUrl) return '';
  const match = videoUrl.match(/EncryptedId=([^&]+)/);
  return match ? match[1] : '';
}

// Extract video ID from hidden input or generate
function extractVideoId($) {
  const hiddenInput = $('input[name="video_id"]').attr('value');
  if (hiddenInput) return hiddenInput;
  
  // Try to extract from URL or generate a random ID
  const videoUrl = $('div.homevideodiv iframe').attr('src') || '';
  const encryptedId = extractEncryptedId(videoUrl);
  if (encryptedId) {
    // Generate a numeric ID from encrypted ID hash
    return encryptedId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0).toString().substring(0, 5);
  }
  return '25212'; // Fallback
}

// Generate unique file ID (16 characters alphanumeric) from slug
// Always unique even for same slug by adding timestamp
function generateUniqueFileId(slug) {
  if (!slug) {
    // Fallback: generate random ID
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  // Add timestamp to ensure uniqueness even for same slug
  const timestamp = Date.now();
  const inputString = `${slug}_${timestamp}`;
  // Create hash from slug + timestamp and convert to uppercase alphanumeric
  const hash = crypto.createHash('md5').update(inputString).digest('hex');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    const index = parseInt(hash.substr(i * 2, 2), 16) % chars.length;
    result += chars[index];
  }
  return result;
}

// Generate unique image filename (16 digits + .jpg) from original URL
// Always unique even for same URL by adding timestamp
function generateUniqueImageFilename(originalUrl) {
  if (!originalUrl) {
    // Fallback: generate random number
    const random = Math.floor(Math.random() * 10000000000000000);
    return `${String(random).padStart(16, '0')}.jpg`;
  }
  // Add timestamp to ensure uniqueness even for same URL
  const timestamp = Date.now();
  const inputString = `${originalUrl}_${timestamp}`;
  // Create hash from URL + timestamp and convert to 16-digit number
  const hash = crypto.createHash('md5').update(inputString).digest('hex');
  // Take first 15 hex characters and convert to number, then pad to 16 digits
  const numberStr = parseInt(hash.substr(0, 15), 16).toString();
  // Ensure 16 digits by padding or truncating
  let result = numberStr.padStart(16, '0');
  if (result.length > 16) {
    result = result.substr(0, 16);
  }
  return `${result}.jpg`;
}

// Replace image URL with sylheter-ogrogoti.com format
function replaceImageUrl(originalUrl, fileId) {
  if (!originalUrl || !fileId) {
    return originalUrl || '';
  }
  const filename = generateUniqueImageFilename(originalUrl);
  return `https://sylheter-ogrogoti.com/images/${fileId}/${filename}`;
}

// Generate document_slide_details array
function generateDocumentSlideDetails() {
  // Generate slides array - include target slides 11, 12, 13 dengan $9d, $9e, $9f
  const slides = [];
  
  // Generate slides 1-10 with text content (if needed)
  // For now, we'll generate minimal slides focusing on 11, 12, 13
  // Generate slides 11, 12, 13 with $9d, $9e, $9f
  slides.push({ slidenumber: 11, slidecontent: '$9d', Articleid: 0 });
  slides.push({ slidenumber: 12, slidecontent: '$9e', Articleid: 0 });
  slides.push({ slidenumber: 13, slidecontent: '$9f', Articleid: 0 });
  
  return slides;
}

// Build full video object from scraped data
function buildVideoObject(videoData, index = 0) {
  const now = new Date();
  const dateISO = now.toISOString();
  const dateFormatted = now.toISOString().split('T')[0];
  
  // Generate document_slide_details for Top_video[0] only
  const document_slide_details = index === 0 ? generateDocumentSlideDetails() : null;
  
  const videoObject = {
    id: 25150 + index, // Generate sequential IDs
    iadb_supplierprofileid: 0,
    issuuurlname: null,
    company: videoData.company || '',
    description: null,
    city: null,
    address1: null,
    address2: null,
    country: null,
    state: null,
    zip: null,
    phone: null,
    fax: null,
    website: null,
    email: null,
    contact_name: null,
    contact_email: null,
    administrator_name: null,
    administrator_email: null,
    company_username: null,
    personal_username: null,
    password: null,
    company_logo: null,
    from_site: null,
    status: false,
    company_summary: null,
    entereddate: dateISO,
    aboutus_logo: null,
    aboutus_desc: null,
    supplier_banner: null,
    product_info: null,
    activemarkets: null,
    is_homepage: index === 0,
    homapage_image: videoData.thumbnailUrl ? videoData.thumbnailUrl.split('/').pop() : '',
    logostatus: false,
    is_active: true,
    istest: true,
    companysocialmedia_facebook: null,
    companysocialmedia_twitter: null,
    companysocialmedia_linkedin: null,
    companysocialmedia_googleplus: null,
    companysocialmedia_youtube: null,
    homepagethumb: false,
    preferrable_company_name: null,
    companyuniqueid: null,
    isapprovedfrom_centralsystem: false,
    countryid: null,
    instagram: null,
    website1: null,
    website2: null,
    email1: null,
    email2: null,
    is_feature: false,
    title: videoData.title || '',
    summary: videoData.description ? `<p>${videoData.description}</p>` : null,
    path: '',
    image: videoData.thumbnailUrl ? videoData.thumbnailUrl.split('/').pop() : '',
    createdon: dateISO,
    ishomepage: false,
    author: videoData.author || videoData.company || '',
    designation: '',
    subject: videoData.title || '',
    need_user_details: false,
    keywords: videoData.keywords || '',
    category: '',
    is_cleanlabel: false,
    sponsorlogo: '',
    sponsorlink: '',
    isalertmailsent: false,
    fileextension: '',
    keytrendstitle: null,
    type: 'Video',
    fif_id: 0,
    background_image: '',
    iadb_ingredientid: 0,
    start_date: dateISO,
    end_date: dateISO,
    content: null,
    banner_id: 0,
    seo_name: null,
    issu_url: null,
    pdf_logo: null,
    site: null,
    issu_url1: null,
    document: null,
    sponcerurl: null,
    isdownloadable: false,
    image_count: null,
    iadb_keytrendid: 0,
    picture: null,
    is_deleted: false,
    issuedate: dateISO,
    intro_text: null,
    iadb_eventid: 0,
    eventname: null,
    event_industry_type_id: 0,
    duration: null,
    location: null,
    organizer: null,
    eventlogo: null,
    eventpreview_status: false,
    sourcetype: 'media',
    logo: null,
    totalcount: 503,
    suppliercompany: null,
    seourl: null,
    seo_url: null,
    site_name: null,
    commonmetainfo: [{
      id: '8577',
      site: 'wpo',
      section: 'video',
      keyword: videoData.keywords || '',
      description: videoData.description || '',
      relatedkeywords: null,
      seo_url: videoData.slug || '',
      seourl: videoData.slug || '',
      summary: null,
      PrimaryCategoryId: 0,
      PrimaryMaterialId: 42,
      metatitle: videoData.title || ''
    }],
    activecategories: null,
    suppliercategory: null,
    material: null,
    othercountry: null,
    source: [
      { id: null, supplier_id: 0, media_id: 0, event_id: 0, source_id: 22, sourcename: 'packaging fif' },
      { id: null, supplier_id: 0, media_id: 0, event_id: 0, source_id: 25, sourcename: 'packaging insights pro' }
    ],
    leadgeneration: null,
    sliders: null,
    sliderimages: null,
    healthcategory: null,
    supplierbannerurl: null,
    city2: null,
    postalcode2: null,
    country2: null,
    isdesktop: false,
    ismobile: false,
    MobileImage: '',
    isyearview: false,
    registrationlink: '',
    mobileregistrationlink: '',
    pciactivecategory: null,
    ispdfsearchviewer: false,
    LocationUrl: null,
    speakerdetails: [{
      mediaid: 25150 + index,
      speakername: '',
      speakerfunction: '',
      speakerimage: '',
      orderid: 1
    }],
    countryfilterlist: null,
    formattype: null,
    videoduration: videoData.duration || '03:04',
    encryptedid: videoData.encryptedId || '',
    supplierproductimages: null,
    industrytypeid: 5,
    IsDateRange: false,
    StartDate: null,
    EndDate: null,
    archivemonthlist: null
  };
  
  // Add document_slide_details to Top_video[0] only
  if (index === 0 && document_slide_details) {
    videoObject.document_slide_details = document_slide_details;
  }
  
  return videoObject;
}

async function scrapeContent(url, slug = null) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const $ = cheerio.load(response.data);
    const html = response.data;

    // Generate unique file ID for this HTML file
    const fileId = generateUniqueFileId(slug || url);

    const title = $('h1.videotitletext').text().trim() || $('title').text().trim();
    const description = $('div.videocontenttext.videosum p').text().trim() || 
                       $('meta[name="description"]').attr('content') || '';
    const company = $('p.videodatecompany').text().split('|')[1]?.trim() || '';
    // Generate dateText using current date (not from scraped data)
    const now = new Date();
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const month = months[now.getMonth()];
    const day = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();
    const dateText = `${month} ${day}, ${year}`;
    const videoUrl = $('div.homevideodiv iframe').attr('src') || '';
    const originalThumbnailUrl = $('meta[property="og:image"]').attr('content') || '';
    // Replace thumbnail URL with unique format
    const thumbnailUrl = replaceImageUrl(originalThumbnailUrl, fileId);
    const keywords = $('meta[name="keywords"]').attr('content') || '';
    const author = $('meta[name="author"]').attr('content') || '';
    
    // Extract encrypted ID from video URL
    const encryptedId = extractEncryptedId(videoUrl);
    const videoId = extractVideoId($);

    const breadcrumbs = [];
    $('.bredgrumsdiv .bredgrumpara a').each((i, el) => {
      const name = $(el).text().trim();
      const href = $(el).attr('href');
      if (name && href) {
        breadcrumbs.push({ name, href });
      }
    });
    const currentItem = $('.bredgrumsdiv .cursordefault').text().trim();
    if (currentItem) {
      breadcrumbs.push({ name: currentItem, href: '' });
    }

    // Extract related videos with full data
    const relatedVideos = [];
    $('.morecontentdiv a.multimediaredirect').each((i, el) => {
      const link = $(el).attr('href');
      const originalImg = $(el).find('img.rec-size').attr('src');
      // Replace image URL with unique format
      const img = replaceImageUrl(originalImg, fileId);
      const alt = $(el).find('img.rec-size').attr('alt');
      const videoTitle = $(el).find('p.morevideotitle').text().trim();
      const duration = $(el).find('.tagbottom').text().trim().replace('Video', '').trim();
      const relatedVideoUrl = $(el).attr('href') || '';
      const relatedEncryptedId = extractEncryptedId(relatedVideoUrl);

      if (link && img && videoTitle) {
        relatedVideos.push({
          link,
          img,
          alt,
          videoTitle,
          duration,
          encryptedId: relatedEncryptedId,
        });
      }
    });

    // Extract all script tags (external, inline, hydration)
    const allScriptTags = [];
    $('script').each((i, el) => {
      const $el = $(el);
      const src = $el.attr('src');
      const scriptContent = $el.html() || '';
      
      if (src) {
        // External script
        allScriptTags.push({
          type: 'external',
          src: src,
          content: ''
        });
      } else if (scriptContent.includes('self.__next_f.push')) {
        // Hydration script
        allScriptTags.push({
          type: 'hydration',
          content: scriptContent,
          src: undefined
        });
      } else if (scriptContent.trim()) {
        // Inline script
        allScriptTags.push({
          type: 'inline',
          content: scriptContent,
          src: undefined
        });
      }
    });

    // Extract CSS chunks from link tags
    const cssChunks = [];
    $('link[rel="stylesheet"][href*="/_next/static/css/"]').each((i, el) => {
      const href = $(el).attr('href');
      const match = href.match(/\/_next\/static\/css\/([^.]+)\.css/);
      if (match) {
        cssChunks.push(match[1]);
      }
    });

    // Extract JS chunks from script tags
    const jsChunks = [];
    $('script[src*="/_next/static/chunks/"]').each((i, el) => {
      const src = $(el).attr('src');
      const match = src.match(/\/_next\/static\/chunks\/(.+?)\.js/);
      if (match) {
        jsChunks.push(match[1]);
      }
    });

    // Extract all hydration scripts (full content)
    const allHydrationScripts = [];
    $('script').each((i, el) => {
      const scriptContent = $(el).html();
      if (scriptContent && scriptContent.includes('self.__next_f.push')) {
        allHydrationScripts.push(scriptContent);
      }
    });

    // Extract data structures from hydration scripts
    let topVideo = null;
    let videoList = [];
    let menuDetails = null;
    let initialData = null;
    let bannerData = null;

    // Try to extract from the largest hydration script (usually contains all data)
    const largestHydrationScript = allHydrationScripts.reduce((largest, current) => {
      return current.length > (largest?.length || 0) ? current : largest;
    }, null);

    if (largestHydrationScript) {
      // Extract full JSON string from hydration script
      // Pattern: self.__next_f.push([1,"json_string"])
      const hydrationPattern = /self\.__next_f\.push\(\[1,"([\s\S]+?)"\]\)/g;
      let match;
      
      while ((match = hydrationPattern.exec(largestHydrationScript)) !== null) {
        try {
          // Unescape the JSON string
          let jsonString = match[1];
          // Replace escaped quotes and backslashes
          jsonString = jsonString.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          
          // Try to extract Top_video (can be array or object)
          const topVideoPatterns = [
            /"Top_video"\s*:\s*(\[[\s\S]*?\])/,
            /"Top_video"\s*:\s*(\{[\s\S]*?\})/,
          ];
          
          for (const pattern of topVideoPatterns) {
            const topVideoMatch = jsonString.match(pattern);
            if (topVideoMatch) {
              try {
                const topVideoData = JSON.parse(topVideoMatch[1]);
                topVideo = Array.isArray(topVideoData) ? topVideoData[0] : topVideoData;
                break;
              } catch (e) {
                // Try next pattern
              }
            }
          }

          // Extract VideoList (can be very large)
          const videoListPattern = /"VideoList"\s*:\s*(\[[\s\S]*?\])/;
          const videoListMatch = jsonString.match(videoListPattern);
          if (videoListMatch) {
            try {
              videoList = JSON.parse(videoListMatch[1]);
            } catch (e) {
              // VideoList might be too large, try to extract partial
              console.warn('⚠️  VideoList too large to parse, will use generated data');
            }
          }

          // Extract menuDetails
          const menuDetailsPattern = /"menuDetails"\s*:\s*(\{[\s\S]*?\})/;
          const menuDetailsMatch = jsonString.match(menuDetailsPattern);
          if (menuDetailsMatch) {
            try {
              menuDetails = JSON.parse(menuDetailsMatch[1]);
            } catch (e) {
              // Continue
            }
          }

          // Extract initialData
          const initialDataPattern = /"initialData"\s*:\s*(\{[\s\S]*?\})/;
          const initialDataMatch = jsonString.match(initialDataPattern);
          if (initialDataMatch) {
            try {
              initialData = JSON.parse(initialDataMatch[1]);
            } catch (e) {
              // Continue
            }
          }

          // Extract bannerdata (note: lowercase 'd' in example)
          const bannerDataPatterns = [
            /"bannerdata"\s*:\s*(\{[\s\S]*?\})/,
            /"bannerData"\s*:\s*(\{[\s\S]*?\})/,
          ];
          for (const pattern of bannerDataPatterns) {
            const bannerDataMatch = jsonString.match(pattern);
            if (bannerDataMatch) {
              try {
                bannerData = JSON.parse(bannerDataMatch[1]);
                break;
              } catch (e) {
                // Continue
              }
            }
          }
        } catch (e) {
          // Continue to next match
        }
      }
    }

    // Build Top_video object if not extracted (fallback)
    if (!topVideo) {
      topVideo = buildVideoObject({
        title,
        description,
        company,
        thumbnailUrl,
        keywords,
        author,
        encryptedId,
        duration: '03:04',
        slug: url.split('/').pop().replace('.html', '')
      }, 0);
    }

    // Build VideoList array if not extracted (fallback)
    if (!videoList || videoList.length === 0) {
      videoList = relatedVideos.map((video, index) => {
        return buildVideoObject({
          title: video.videoTitle,
          description: '',
          company: '',
          thumbnailUrl: video.img,
          keywords: '',
          author: '',
          encryptedId: video.encryptedId,
          duration: video.duration,
          slug: video.link.split('/').pop().replace('.html', '')
        }, index + 1);
      });
    }

    return {
      title,
      description,
      company,
      dateText,
      videoUrl,
      thumbnailUrl,
      keywords,
      breadcrumbs,
      relatedVideos,
      author,
      encryptedId,
      videoId,
      topVideo,
      videoList,
      menuDetails,
      initialData,
      bannerData,
      allHydrationScripts,
      allScriptTags,
      cssChunks,
      jsChunks,
    };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    throw error;
  }
}

// Escape JSON string for hydration script
function escapeForHydration(obj) {
  return JSON.stringify(obj)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// Generate menu details data
function generateMenuDetails(siteConfig) {
  return {
    menuData: [
      {
        Id: 108,
        Name: "News",
        MenuLogo: null,
        URL: "news.html",
        IngredientName: null,
        Level2: [[[
          { categoryId: null, MaterialId: null, Id: 164, Name: "Industry News", MenuLogo: "industrynews", URL: "news.html", Level3: null },
          { categoryId: null, MaterialId: null, Id: 165, Name: "New Product Development", MenuLogo: "newproductdevelopment", URL: "new-product-development.html", Level3: null },
          { categoryId: null, MaterialId: null, Id: 166, Name: "Key Trends", MenuLogo: "keytrends", URL: "key-trends.html", Level3: null }
        ]]]
      },
      {
        Id: 109,
        Name: "Videos",
        MenuLogo: null,
        URL: "videos.html",
        IngredientName: null,
        Level2: [[[
          { categoryId: null, MaterialId: null, Id: 168, Name: "Video Listing", MenuLogo: "videolisting", URL: "videos.html", Level3: null }
        ]]]
      },
      {
        Id: 111,
        Name: "Events",
        MenuLogo: null,
        URL: "event-calendar.html",
        IngredientName: null,
        Level2: [[[
          { categoryId: null, MaterialId: null, Id: 170, Name: "Event Listing", MenuLogo: "calender", URL: "events.html", Level3: null },
          { categoryId: null, MaterialId: null, Id: 172, Name: "Event Previews", MenuLogo: "preview", URL: "event-previews.html", Level3: null },
          { categoryId: null, MaterialId: null, Id: 171, Name: "Event Reviews", MenuLogo: "review", URL: "event-reviews.html", Level3: null }
        ]]]
      },
      {
        Id: 110,
        Name: "Suppliers",
        MenuLogo: null,
        URL: "profile-directory.html",
        IngredientName: null,
        Level2: [[[
          { categoryId: null, MaterialId: null, Id: 167, Name: "Supplier Profiles", MenuLogo: "supplierprofiles", URL: "supplier-profiles.html", Level3: null }
        ]]]
      }
    ],
    mustReadDetails: [
      {
        id: 624410,
        articleid: 350331,
        position: 1,
        seourl: "Drinktec-2025-beverage-packaging-closure-sustainability",
        articletitle: "Drinktec 2025 preview: Industry to present next-gen beverage packaging, closure solutions and circularity",
        formattedpicture: "6389294091818874578.9._Drinktec_Messe_.jpg",
        sitename: "pi",
        createdon: "09/16/2025 00:00:00",
        articleKeywords: "Sports Closures, Cans, PET Bottles, Glass, Lightweighting Reusable Cups, Compostable Coffee Capsules",
        totalcount: 3561
      }
    ],
    toptwofis: []
  };
}

// Generate banner data
function generateBannerData() {
  const now = new Date();
  const dateISO = now.toISOString();
  
  return {
    horizontalBanner: {
      BannerTypeAd: null,
      IngredientsID: 0,
      HtmlContent: "",
      ImpressionCounter: "",
      ClickTagScript: "clickTag",
      UniqueId: "",
      UniqueCode: "",
      Summary: null,
      Width: 1000,
      Height: 150,
      AdvertiserId: 0,
      BannerTypeId: 5,
      DestinationUrl: "https://www.krones.com/en/drinktec-2025.php",
      Duration: 0,
      DurationType: "",
      EndDate: null,
      Type: { Height: 0, Id: 0, Name: "", Width: 0, TotalCount: null },
      Id: 9249,
      IsActive: false,
      IsHomepageOnly: false,
      Keywords: "",
      Name: "Krones Horizontal Banner",
      SourceUrl: "d459128f-139d-4eb9-96b8-a08f81343b27.jpg",
      SourceUrl2: "",
      WebPSourceUrl: "",
      StartDate: null,
      TotalCount: 9,
      AdvertiserInfo: {
        Address: "",
        Company: "",
        Description: "",
        Designation: "",
        Email: "",
        Fax: "",
        HasKeywordBanners: false,
        HasSupplierListing: false,
        Id: 0,
        Name: "",
        NumberOfKeywords: 0,
        Password: "",
        Phone: "",
        Website: "",
        TotalCount: null
      },
      SiteList: null,
      Country: null,
      Count: null,
      Date: null,
      FIFViews: null,
      FIFHits: null,
      NHViews: null,
      NHHits: null,
      IsTest: false,
      Banner_Type: 0,
      Expandable: false,
      IsClickTag: false,
      PathTagUrl: "",
      AdDoubleclick: "",
      PictureExt: "jpg",
      AlternativeUrl: "",
      DisplayTime: 0,
      startdates: dateISO,
      enddates: null,
      bannerid: 9249,
      site_id: 3,
      bannerkeywords: "",
      is_homepage_only: false,
      menuurl: "videos.html",
      menuname: "Videos",
      competitorname: null,
      bannercompany: "Krones",
      is_clicktag: false,
      duration_type: "",
      bannername: "Krones Horizontal Banner",
      bannersummary: "",
      landingbannerid: 0,
      isthreedimensional: false,
      defaultimage: "",
      bannertitletext: null,
      descriptiontext: null,
      downloadtext: null,
      bannerlogo: null,
      chinesebannertitletext: null,
      chinesedescriptiontext: null,
      chinesedownloadtext: null,
      chinesebannername: null,
      isglobal: false,
      isdocument: false,
      isimage: true,
      islink: false,
      isnew: false,
      countrycount: 0,
      usercount: 0,
      surveyyear: 0,
      surveyid: 0,
      bannerorder: 0,
      istrendwheelpopup: false,
      colorcode: null,
      buttontext: null,
      Viewscount: 469,
      BrowserName: null,
      IsPrivate: false,
      AltText: "Perfectly integrated packaging solutions"
    },
    defaultsquareTileBanners: {
      BannerTypeAd: "image",
      IngredientsID: 0,
      HtmlContent: "",
      ImpressionCounter: "",
      ClickTagScript: "clickTag",
      UniqueId: "",
      UniqueCode: "",
      Summary: null,
      Width: 250,
      Height: 250,
      AdvertiserId: 0,
      BannerTypeId: 4,
      DestinationUrl: "http://www.nutritioninsight.com/",
      Duration: 0,
      DurationType: "",
      EndDate: null,
      Type: { Height: 0, Id: 0, Name: "", Width: 0, TotalCount: null },
      Id: 2129,
      IsActive: false,
      IsHomepageOnly: false,
      Keywords: "",
      Name: "Square tile [DEFAULT] - Shows when no other AD is available",
      SourceUrl: "e20f48f5-7ffd-4705-8b21-666f388ff1b4.GIF",
      SourceUrl2: "",
      WebPSourceUrl: "",
      StartDate: null,
      TotalCount: 69,
      AdvertiserInfo: {
        Address: "",
        Company: "",
        Description: "",
        Designation: "",
        Email: "",
        Fax: "",
        HasKeywordBanners: false,
        HasSupplierListing: false,
        Id: 0,
        Name: "",
        NumberOfKeywords: 0,
        Password: "",
        Phone: "",
        Website: "",
        TotalCount: null
      },
      SiteList: null,
      Country: null,
      Count: null,
      Date: null,
      FIFViews: null,
      FIFHits: null,
      NHViews: null,
      NHHits: null,
      IsTest: false,
      Banner_Type: 0,
      Expandable: false,
      IsClickTag: false,
      PathTagUrl: "",
      AdDoubleclick: "",
      PictureExt: "GIF",
      AlternativeUrl: "",
      DisplayTime: 0,
      startdates: dateISO,
      enddates: null,
      bannerid: 2129,
      site_id: 2,
      bannerkeywords: "",
      is_homepage_only: false,
      menuurl: null,
      menuname: "Home",
      competitorname: null,
      bannercompany: "CNS Media",
      is_clicktag: false,
      duration_type: "",
      bannername: "Square tile [DEFAULT] - Shows when no other AD is available",
      bannersummary: "",
      landingbannerid: 0,
      isthreedimensional: false,
      defaultimage: "",
      bannertitletext: null,
      descriptiontext: null,
      downloadtext: null,
      bannerlogo: null,
      chinesebannertitletext: null,
      chinesedescriptiontext: null,
      chinesedownloadtext: null,
      chinesebannername: null,
      isglobal: false,
      isdocument: false,
      isimage: true,
      islink: false,
      isnew: false,
      countrycount: 0,
      usercount: 0,
      surveyyear: 0,
      surveyid: 0,
      bannerorder: 0,
      istrendwheelpopup: false,
      colorcode: null,
      buttontext: null,
      Viewscount: 0,
      BrowserName: null,
      IsPrivate: false,
      AltText: null
    },
    rectangularBanner: {
      BannerTypeAd: "image",
      IngredientsID: 0,
      HtmlContent: "",
      ImpressionCounter: "",
      ClickTagScript: "clickTag",
      UniqueId: "",
      UniqueCode: "",
      Summary: null,
      Width: 210,
      Height: 320,
      AdvertiserId: 0,
      BannerTypeId: 2,
      DestinationUrl: "https://www.foodingredientsfirst.com/theworldoffoodingredients.html",
      Duration: 0,
      DurationType: "",
      EndDate: null,
      Type: { Height: 0, Id: 0, Name: "", Width: 0, TotalCount: null },
      Id: 2131,
      IsActive: false,
      IsHomepageOnly: false,
      Keywords: "",
      Name: "TWOFI subscription [DEFAULT] - Shows when no other AD is available",
      SourceUrl: "fb5bfc19-e7b6-40d3-ab2d-472f9892d2d2.jpg",
      SourceUrl2: "",
      WebPSourceUrl: "",
      StartDate: null,
      TotalCount: 69,
      AdvertiserInfo: {
        Address: "",
        Company: "",
        Description: "",
        Designation: "",
        Email: "",
        Fax: "",
        HasKeywordBanners: false,
        HasSupplierListing: false,
        Id: 0,
        Name: "",
        NumberOfKeywords: 0,
        Password: "",
        Phone: "",
        Website: "",
        TotalCount: null
      },
      SiteList: null,
      Country: null,
      Count: null,
      Date: null,
      FIFViews: null,
      FIFHits: null,
      NHViews: null,
      NHHits: null,
      IsTest: false,
      Banner_Type: 0,
      Expandable: false,
      IsClickTag: false,
      PathTagUrl: "",
      AdDoubleclick: "",
      PictureExt: "jpg",
      AlternativeUrl: "",
      DisplayTime: 0,
      startdates: dateISO,
      enddates: null,
      bannerid: 2131,
      site_id: 2,
      bannerkeywords: "",
      is_homepage_only: false,
      menuurl: "news.html",
      menuname: "Industry News",
      competitorname: null,
      bannercompany: "CNS Media",
      is_clicktag: false,
      duration_type: "",
      bannername: "TWOFI subscription [DEFAULT] - Shows when no other AD is available",
      bannersummary: "",
      landingbannerid: 0,
      isthreedimensional: false,
      defaultimage: "",
      bannertitletext: null,
      descriptiontext: null,
      downloadtext: null,
      bannerlogo: null,
      chinesebannertitletext: null,
      chinesedescriptiontext: null,
      chinesedownloadtext: null,
      chinesebannername: null,
      isglobal: false,
      isdocument: false,
      isimage: true,
      islink: false,
      isnew: false,
      countrycount: 0,
      usercount: 0,
      surveyyear: 0,
      surveyid: 0,
      bannerorder: 0,
      istrendwheelpopup: false,
      colorcode: null,
      buttontext: null,
      Viewscount: 0,
      BrowserName: null,
      IsPrivate: false,
      AltText: null
    },
    defaultverticalBanners: {
      BannerTypeAd: "image",
      IngredientsID: 0,
      HtmlContent: "",
      ImpressionCounter: "",
      ClickTagScript: "clickTag",
      UniqueId: "",
      UniqueCode: "",
      Summary: null,
      Width: 210,
      Height: 600,
      AdvertiserId: 0,
      BannerTypeId: 1,
      DestinationUrl: "https://www.innovamarketinsights.com/",
      Duration: 0,
      DurationType: "",
      EndDate: null,
      Type: { Height: 0, Id: 0, Name: "", Width: 0, TotalCount: null },
      Id: 2130,
      IsActive: false,
      IsHomepageOnly: false,
      Keywords: "",
      Name: "Vertical Tile [DEFAULT] - Shows when no other AD is available",
      SourceUrl: "d7fd8d15-a11c-4069-99ca-d1609947f394.jpg",
      SourceUrl2: "",
      WebPSourceUrl: "",
      StartDate: null,
      TotalCount: 69,
      AdvertiserInfo: {
        Address: "",
        Company: "",
        Description: "",
        Designation: "",
        Email: "",
        Fax: "",
        HasKeywordBanners: false,
        HasSupplierListing: false,
        Id: 0,
        Name: "",
        NumberOfKeywords: 0,
        Password: "",
        Phone: "",
        Website: "",
        TotalCount: null
      },
      SiteList: null,
      Country: null,
      Count: null,
      Date: null,
      FIFViews: null,
      FIFHits: null,
      NHViews: null,
      NHHits: null,
      IsTest: false,
      Banner_Type: 0,
      Expandable: false,
      IsClickTag: false,
      PathTagUrl: "",
      AdDoubleclick: "",
      PictureExt: "jpg",
      AlternativeUrl: "",
      DisplayTime: 0,
      startdates: dateISO,
      enddates: null,
      bannerid: 2130,
      site_id: 2,
      bannerkeywords: "",
      is_homepage_only: false,
      menuurl: "key-trends.html",
      menuname: "Key Trends",
      competitorname: null,
      bannercompany: "CNS Media",
      is_clicktag: false,
      duration_type: "",
      bannername: "Vertical Tile [DEFAULT] - Shows when no other AD is available",
      bannersummary: "",
      landingbannerid: 0,
      isthreedimensional: false,
      defaultimage: "",
      bannertitletext: null,
      descriptiontext: null,
      downloadtext: null,
      bannerlogo: null,
      chinesebannertitletext: null,
      chinesedescriptiontext: null,
      chinesedownloadtext: null,
      chinesebannername: null,
      isglobal: false,
      isdocument: false,
      isimage: true,
      islink: false,
      isnew: false,
      countrycount: 0,
      usercount: 0,
      surveyyear: 0,
      surveyid: 0,
      bannerorder: 0,
      istrendwheelpopup: false,
      colorcode: null,
      buttontext: null,
      Viewscount: 0,
      BrowserName: null,
      IsPrivate: false,
      AltText: null
    },
    defaultHorizontalBanner: {
      BannerTypeAd: "image",
      IngredientsID: 0,
      HtmlContent: "",
      ImpressionCounter: "",
      ClickTagScript: "clickTag",
      UniqueId: "",
      UniqueCode: "",
      Summary: null,
      Width: 1000,
      Height: 150,
      AdvertiserId: 0,
      BannerTypeId: 5,
      DestinationUrl: "http://www.foodingredientsfirst.com/",
      Duration: 0,
      DurationType: "",
      EndDate: null,
      Type: { Height: 0, Id: 0, Name: "", Width: 0, TotalCount: null },
      Id: 2128,
      IsActive: false,
      IsHomepageOnly: false,
      Keywords: "",
      Name: "Horizontal Top Tile [DEFAULT] - Shows when no other AD is available",
      SourceUrl: "a773560c-fe31-42ee-a990-7d5509e76343.png",
      SourceUrl2: "",
      WebPSourceUrl: "",
      StartDate: null,
      TotalCount: 69,
      AdvertiserInfo: {
        Address: "",
        Company: "",
        Description: "",
        Designation: "",
        Email: "",
        Fax: "",
        HasKeywordBanners: false,
        HasSupplierListing: false,
        Id: 0,
        Name: "",
        NumberOfKeywords: 0,
        Password: "",
        Phone: "",
        Website: "",
        TotalCount: null
      },
      SiteList: null,
      Country: null,
      Count: null,
      Date: null,
      FIFViews: null,
      FIFHits: null,
      NHViews: null,
      NHHits: null,
      IsTest: false,
      Banner_Type: 0,
      Expandable: false,
      IsClickTag: false,
      PathTagUrl: "",
      AdDoubleclick: "",
      PictureExt: "png",
      AlternativeUrl: "",
      DisplayTime: 0,
      startdates: dateISO,
      enddates: null,
      bannerid: 2128,
      site_id: 2,
      bannerkeywords: "",
      is_homepage_only: false,
      menuurl: "news/category/gut-health.html",
      menuname: "Gut Health",
      competitorname: null,
      bannercompany: "CNS Media",
      is_clicktag: false,
      duration_type: "",
      bannername: "Horizontal Top Tile [DEFAULT] - Shows when no other AD is available",
      bannersummary: "",
      landingbannerid: 0,
      isthreedimensional: false,
      defaultimage: "",
      bannertitletext: null,
      descriptiontext: null,
      downloadtext: null,
      bannerlogo: null,
      chinesebannertitletext: null,
      chinesedescriptiontext: null,
      chinesedownloadtext: null,
      chinesebannername: null,
      isglobal: false,
      isdocument: false,
      isimage: true,
      islink: false,
      isnew: false,
      countrycount: 0,
      usercount: 0,
      surveyyear: 0,
      surveyid: 0,
      bannerorder: 0,
      istrendwheelpopup: false,
      colorcode: null,
      buttontext: null,
      Viewscount: 0,
      BrowserName: null,
      IsPrivate: false,
      AltText: null
    },
    impressionCounter: "",
    popupBanner: [],
    nosqlBanners: [
      "$a:props:Tags:1:props:Tags:props:Tags:3:props:bannerdata:horizontalBanner",
      {
        BannerTypeAd: "image",
        IngredientsID: 0,
        HtmlContent: "",
        ImpressionCounter: "",
        ClickTagScript: "clickTag",
        UniqueId: "",
        UniqueCode: "",
        Summary: null,
        Width: 210,
        Height: 210,
        AdvertiserId: 0,
        BannerTypeId: 4,
        DestinationUrl: "https://resources.paktech-opi.com/eu-packaging-without-compromise",
        Duration: 0,
        DurationType: "",
        EndDate: null,
        Type: { Height: 0, Id: 0, Name: "", Width: 0, TotalCount: null },
        Id: 9305,
        IsActive: false,
        IsHomepageOnly: false,
        Keywords: "",
        Name: "BDB PackTech Square Banner",
        SourceUrl: "4d846750-1db1-4896-ad0c-b9097e256d6c.gif",
        SourceUrl2: "",
        WebPSourceUrl: "",
        StartDate: null,
        TotalCount: 9,
        AdvertiserInfo: {
          Address: "",
          Company: "",
          Description: "",
          Designation: "",
          Email: "",
          Fax: "",
          HasKeywordBanners: false,
          HasSupplierListing: false,
          Id: 0,
          Name: "",
          NumberOfKeywords: 0,
          Password: "",
          Phone: "",
          Website: "",
          TotalCount: null
        },
        SiteList: null,
        Country: null,
        Count: null,
        Date: null,
        FIFViews: null,
        FIFHits: null,
        NHViews: null,
        NHHits: null,
        IsTest: false,
        Banner_Type: 0,
        Expandable: false,
        IsClickTag: false,
        PathTagUrl: "",
        AdDoubleclick: "",
        PictureExt: "gif",
        AlternativeUrl: "",
        DisplayTime: 0,
        startdates: dateISO,
        enddates: null,
        bannerid: 9305,
        site_id: 3,
        bannerkeywords: "",
        is_homepage_only: false,
        menuurl: "videos.html",
        menuname: "Videos",
        competitorname: null,
        bannercompany: "BDB PackTech",
        is_clicktag: false,
        duration_type: "",
        bannername: "BDB PackTech Square Banner",
        bannersummary: "",
        landingbannerid: 0,
        isthreedimensional: false,
        defaultimage: "",
        bannertitletext: null,
        descriptiontext: null,
        downloadtext: null,
        bannerlogo: null,
        chinesebannertitletext: null,
        chinesedescriptiontext: null,
        chinesedownloadtext: null,
        chinesebannername: null,
        isglobal: false,
        isdocument: false,
        isimage: true,
        islink: false,
        isnew: false,
        countrycount: 0,
        usercount: 0,
        surveyyear: 0,
        surveyid: 0,
        bannerorder: 0,
        istrendwheelpopup: false,
        colorcode: null,
        buttontext: null,
        Viewscount: 1408,
        BrowserName: null,
        IsPrivate: false,
        AltText: "PackTech"
      },
      {
        BannerTypeAd: "image",
        IngredientsID: 0,
        HtmlContent: "",
        ImpressionCounter: "",
        ClickTagScript: "clickTag",
        UniqueId: "",
        UniqueCode: "",
        Summary: null,
        Width: 210,
        Height: 600,
        AdvertiserId: 0,
        BannerTypeId: 1,
        DestinationUrl: "https://www.k-tradefair.nl/nl/Bezoeker_Service/Wat_u_kunt_verwachten/Redenen_voor_uw_bezoek",
        Duration: 0,
        DurationType: "",
        EndDate: null,
        Type: { Height: 0, Id: 0, Name: "", Width: 0, TotalCount: null },
        Id: 9208,
        IsActive: false,
        IsHomepageOnly: false,
        Keywords: "",
        Name: "Fairwise Vertical Web Banner",
        SourceUrl: "5700074b-d848-4d47-ae29-088270e6c1b1.jpg",
        SourceUrl2: "",
        WebPSourceUrl: "3700b239-889e-4377-a26b-395276719cad.webp",
        StartDate: null,
        TotalCount: 9,
        AdvertiserInfo: {
          Address: "",
          Company: "",
          Description: "",
          Designation: "",
          Email: "",
          Fax: "",
          HasKeywordBanners: false,
          HasSupplierListing: false,
          Id: 0,
          Name: "",
          NumberOfKeywords: 0,
          Password: "",
          Phone: "",
          Website: "",
          TotalCount: null
        },
        SiteList: null,
        Country: null,
        Count: null,
        Date: null,
        FIFViews: null,
        FIFHits: null,
        NHViews: null,
        NHHits: null,
        IsTest: false,
        Banner_Type: 0,
        Expandable: false,
        IsClickTag: false,
        PathTagUrl: "",
        AdDoubleclick: "",
        PictureExt: "webp",
        AlternativeUrl: "",
        DisplayTime: 0,
        startdates: dateISO,
        enddates: null,
        bannerid: 9208,
        site_id: 3,
        bannerkeywords: "",
        is_homepage_only: false,
        menuurl: "videos.html",
        menuname: "Videos",
        competitorname: null,
        bannercompany: "Fairwise",
        is_clicktag: false,
        duration_type: "",
        bannername: "Fairwise Vertical Web Banner",
        bannersummary: "",
        landingbannerid: 0,
        isthreedimensional: false,
        defaultimage: "",
        bannertitletext: null,
        descriptiontext: null,
        downloadtext: null,
        bannerlogo: null,
        chinesebannertitletext: null,
        chinesedescriptiontext: null,
        chinesedownloadtext: null,
        chinesebannername: null,
        isglobal: false,
        isdocument: false,
        isimage: true,
        islink: false,
        isnew: false,
        countrycount: 0,
        usercount: 0,
        surveyyear: 0,
        surveyid: 0,
        bannerorder: 0,
        istrendwheelpopup: false,
        colorcode: null,
        buttontext: null,
        Viewscount: 469,
        BrowserName: null,
        IsPrivate: false,
        AltText: "It all starts at K"
      },
      {
        BannerTypeAd: "image",
        IngredientsID: 0,
        HtmlContent: "",
        ImpressionCounter: "",
        ClickTagScript: "clickTag",
        UniqueId: "",
        UniqueCode: "",
        Summary: null,
        Width: 210,
        Height: 320,
        AdvertiserId: 0,
        BannerTypeId: 2,
        DestinationUrl: "https://www.labelexpo-europe.com/",
        Duration: 0,
        DurationType: "",
        EndDate: null,
        Type: { Height: 0, Id: 0, Name: "", Width: 0, TotalCount: null },
        Id: 9312,
        IsActive: false,
        IsHomepageOnly: false,
        Keywords: "",
        Name: "Barter Label Expo Rectangular Banner",
        SourceUrl: "24328aad-23b3-4010-b714-c51cddc34c5e.png",
        SourceUrl2: "",
        WebPSourceUrl: "cc92efa3-ca96-4929-91a8-ac3da4c5af6d.webp",
        StartDate: null,
        TotalCount: 9,
        AdvertiserInfo: {
          Address: "",
          Company: "",
          Description: "",
          Designation: "",
          Email: "",
          Fax: "",
          HasKeywordBanners: false,
          HasSupplierListing: false,
          Id: 0,
          Name: "",
          NumberOfKeywords: 0,
          Password: "",
          Phone: "",
          Website: "",
          TotalCount: null
        },
        SiteList: null,
        Country: null,
        Count: null,
        Date: null,
        FIFViews: null,
        FIFHits: null,
        NHViews: null,
        NHHits: null,
        IsTest: false,
        Banner_Type: 0,
        Expandable: false,
        IsClickTag: false,
        PathTagUrl: "",
        AdDoubleclick: "",
        PictureExt: "webp",
        AlternativeUrl: "",
        DisplayTime: 0,
        startdates: dateISO,
        enddates: null,
        bannerid: 9312,
        site_id: 3,
        bannerkeywords: "",
        is_homepage_only: false,
        menuurl: "videos.html",
        menuname: "Videos",
        competitorname: null,
        bannercompany: "Barter Label Expo",
        is_clicktag: false,
        duration_type: "",
        bannername: "Barter Label Expo Rectangular Banner",
        bannersummary: "",
        landingbannerid: 0,
        isthreedimensional: false,
        defaultimage: "",
        bannertitletext: null,
        descriptiontext: null,
        downloadtext: null,
        bannerlogo: null,
        chinesebannertitletext: null,
        chinesedescriptiontext: null,
        chinesedownloadtext: null,
        chinesebannername: null,
        isglobal: false,
        isdocument: false,
        isimage: true,
        islink: false,
        isnew: false,
        countrycount: 0,
        usercount: 0,
        surveyyear: 0,
        surveyid: 0,
        bannerorder: 0,
        istrendwheelpopup: false,
        colorcode: null,
        buttontext: null,
        Viewscount: 703,
        BrowserName: null,
        IsPrivate: false,
        AltText: "Label Expo Europe 16 to November 2025"
      }
    ],
    leftMarginBanner: "",
    rightMarginBanner: "",
    squareTileBanners: "$a:props:Tags:1:props:Tags:props:Tags:3:props:bannerdata:nosqlBanners:1",
    skyscraperBanners: "$a:props:Tags:1:props:Tags:props:Tags:3:props:bannerdata:nosqlBanners:2",
    verticalBanners: "$a:props:Tags:1:props:Tags:props:Tags:3:props:bannerdata:nosqlBanners:3",
    bottomBarBanners: "",
    landingbanner: "",
    marginBanner: "",
    allBanners: "$a:props:Tags:1:props:Tags:props:Tags:3:props:bannerdata:nosqlBanners",
    landingtime: 20
  };
}

// Generate Next.js hydration scripts with full data (matching example structure)
function generateHydrationScripts(data, slug, chunks) {
  // Load site config for URL
  const configPath = path.join(__dirname, '../config/site-config.json');
  let siteConfig = {};
  try {
    siteConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (e) {
    console.warn('⚠️  Config file not found, using defaults');
  }
  
  const siteroot = siteConfig.siteConfig?.siteroot || 'https://www.packaginginsights.com';
  const videoPath = siteConfig.siteConfig?.videoPath || '/video';
  const url = `${siteroot}${videoPath}/${slug}.html`;
  const escapedTitle = data.title.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  const escapedDesc = data.description.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  const webpackChunk = chunks.webpack || null;

  // Fix Top_video format: must be ARRAY, not object
  // Ensure Top_video[0] has document_slide_details
  let topVideoArray = null;
  if (data.topVideo) {
    const topVideo = { ...data.topVideo };
    
    // Ensure document_slide_details exists in Top_video[0]
    if (!topVideo.document_slide_details) {
      topVideo.document_slide_details = generateDocumentSlideDetails();
    }
    
    topVideoArray = [topVideo];
  }

  // Use scraped data if available, otherwise generate
  const menuDetails = data.menuDetails || generateMenuDetails(siteConfig);
  const bannerData = data.bannerData || generateBannerData();
  const initialData = data.initialData || {
    primarydata: siteConfig.primarydata || [],
    industrytype: siteConfig.industrytype || [],
    accesskey: '',
    secretkey: '',
    istestsite: siteConfig.siteConfig?.istestsite || 'false',
    defaultimage: siteConfig.siteConfig?.defaultimage || 'https://assets.innovamarketinsights360.com/insightsbeta/common/images/pi_defaultlogo.svg',
    device: 'Desktop',
    reportsapiurl: siteConfig.siteConfig?.reportsapiurl || 'https://api.foodingredientsfirst.com/insights',
    contentPath: siteConfig.siteConfig?.contentPath || 'https://assets.innovamarketinsights360.com/insightsbeta/pi',
    siteroot: siteroot,
    commonPath: siteConfig.siteConfig?.commonPath || 'https://assets.innovamarketinsights360.com/insightsbeta',
    apiconnection: siteConfig.siteConfig?.apiconnection || 'https://api.foodingredientsfirst.com/insights',
    SiteId: siteConfig.siteConfig?.SiteId || 22,
    clarityId: siteConfig.siteConfig?.clarityId || 'jgjbmlx8pe',
    metaapiconnection: siteConfig.siteConfig?.metaapiconnection || 'http://api.innovami.internal/meta',
    apiconnectionserver: siteConfig.siteConfig?.apiconnectionserver || 'http://api.innovami.internal/insights'
  };

  // Build full hydration data object (matching example structure)
  const hydrationData = {
    device: 'Desktop',
    from: 'Videos',
    about: 'videos',
    defaultimage: siteConfig.siteConfig?.defaultimage || 'https://assets.innovamarketinsights360.com/insightsbeta/common/images/pi_defaultlogo.svg',
    apiconnection: siteConfig.siteConfig?.apiconnection || 'https://api.foodingredientsfirst.com/insights',
    source: 'pi',
    siteroot: siteroot,
    Top_video: topVideoArray, // FIXED: Now array format
    VideoList: data.videoList || [],
    error: null,
    needUserDetails: false,
    SiteId: siteConfig.siteConfig?.SiteId || 22,
    Country: 'Bangladesh',
    sponsordata: '',
    mobrectbanner: '',
    previousurl: '',
    bannerdata: bannerData,
    mobilemenu: '',
    cookiepolicystatus: '$undefined',
    menuDetails: menuDetails,
    initialData: initialData
  };

  // Escape the full data object
  const escapedHydrationData = escapeForHydration(hydrationData);

  // Generate JSON-LD script content
  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": data.title,
    "description": data.description,
    "thumbnailUrl": data.thumbnailUrl || '',
    "uploadDate": new Date().toISOString()
  };
  const escapedJsonLd = escapeForHydration(jsonLdData);

  // Generate banner components ($L16)
  const bannerVideos = {
    source: 'pi',
    device: 'Desktop',
    Id: '',
    Name: data.title,
    BannerType: 'Videos',
    section: ''
  };
  const bannerCompany = {
    source: 'pi',
    device: 'Desktop',
    Id: '',
    Name: data.company || '',
    BannerType: 'Company',
    section: ''
  };
  const bannerKeywords = {
    source: 'pi',
    device: 'Desktop',
    Id: '',
    Name: data.keywords || '',
    BannerType: 'Keywords',
    section: ''
  };
  const escapedBannerVideos = escapeForHydration(bannerVideos);
  const escapedBannerCompany = escapeForHydration(bannerCompany);
  const escapedBannerKeywords = escapeForHydration(bannerKeywords);

  // Generate 8 random CSS chunk hashes
  const cssHashes = Array.from({ length: 8 }, () => generateHash(14));
  const cssHydrationLinks = cssHashes.map((hash, index) => 
    `${index + 1}:HL[\\"/_next/static/css/${hash}.css\\",\\"style\\"]`
  ).join('\\n');
  
  return `
	${webpackChunk ? `<script src="/_next/static/chunks/${webpackChunk}.js" async=""></script>` : ''}
	<script>(self.__next_f=self.__next_f||[]).push([0])</script>
	<script>self.__next_f.push([1,"9:\\"$Sreact.fragment\\"\\nb:I[3405,[],\\"\\"]\\nc:I[48274,[],\\"\\"]\\ne:I[98080,[],\\"OutletBoundary\\"]\\n10:I[98080,[],\\"MetadataBoundary\\"]\\n12:I[98080,[],\\"ViewportBoundary\\"]\\n14:I[88306,[],\\"\\"]\\n${cssHydrationLinks}\\n"])</script>
	<script>self.__next_f.push([1,"0:{\\"P\\":null,\\"b\\":\\"SzcZiY29wPC6TYSEML0ds\\",\\"p\\":\\"\\",\\"c\\":[\\"\\",\\"video\\",\\"${slug}.html\\"],\\"i\\":false,\\"f\\":[[[\\"\\",{\\"Tags\\":[\\"video\\",{\\"Tags\\":[[\\"seo\\",\\"${slug}.html\\",\\"d\\"],{\\"Tags\\":[\\"__PAGE__\\",{}]}]}]},\\"$undefined\\",\\"$undefined\\",true]]}]\\n"])</script>
	<script>self.__next_f.push([1,"13:[[\\"$\\",\\"meta\\",\\"0\\",{\\"name\\":\\"viewport\\",\\"content\\":\\"width=device-width, initial-scale=1\\"}]]\\n"])</script>
	<script>self.__next_f.push([1,"11:[[\\"$\\",\\"meta\\",\\"0\\",{\\"charSet\\":\\"utf-8\\"}],[\"$\",\"meta\",\"1\",{\"name\":\"description\",\"content\":\"${escapedDesc}\"}],[\"$\",\"meta\",\"2\",{\"name\":\"keywords\",\"content\":\"${data.keywords || ''}\"}],[\"$\",\"link\",\"3\",{\"rel\":\"canonical\",\"href\":\"${url}\"}],[\"$\",\"meta\",\"4\",{\"property\":\"og:title\",\"content\":\"${escapedTitle}\"}],[\"$\",\"meta\",\"5\",{\"property\":\"og:description\",\"content\":\"${escapedDesc}\"}],[\"$\",\"meta\",\"6\",{\"property\":\"og:url\",\"content\":\"${url}\"}],[\"$\",\"meta\",\"7\",{\"property\":\"og:site_name\",\"content\":\"${siteroot}\"}],[\"$\",\"meta\",\"8\",{\"property\":\"og:image\",\"content\":\"${data.thumbnailUrl || ''}\"}],[\"$\",\"meta\",\"9\",{\"name\":\"twitter:card\",\"content\":\"summary_large_image\\"}],[\"$\",\"meta\",\"10\",{\"name\":\"twitter:site\",\"content\":\"${siteroot}\"}],[\"$\",\"meta\",\"11\",{\"name\":\"twitter:title\",\"content\":\"${escapedTitle}\"}],[\"$\",\"meta\",\"12\",{\"name\":\"twitter:description\",\"content\":\"${escapedDesc}\"}],[\"$\",\"meta\",\"13\",{\"name\":\"twitter:image\",\"content\":\"${data.thumbnailUrl || ''}\"}]]\\n"])</script>
	<script>self.__next_f.push([1,"f:null\\n"])</script>
	<script>self.__next_f.push([1,"15:I[17204,[\\"7240\\",\\"static/chunks/53c13509-0d4fc72ddf83f729.js\\",\\"7699\\",\\"static/chunks/8e1d74a4-b53153930fa1f840.js\\",\\"614\\",\\"static/chunks/3d47b92a-e354a28c805214ca.js\\",\\"7259\\",\\"static/chunks/479ba886-59c64b7535c61d12.js\\",\\"6950\\",\\"static/chunks/f8025e75-ac09396323c75bf9.js\\",\\"5131\\",\\"static/chunks/5131-86750c6ed50bfaa2.js\\",\\"4134\\",\\"static/chunks/4134-f058a0f7d2fee07d.js\\",\\"9781\\",\\"static/chunks/9781-6b379b5c7c1afdc0.js\\",\\"8909\\",\\"static/chunks/8909-fd7c41986e96ad19.js\\",\\"563\\",\\"static/chunks/563-097f9277f0fcebe8.js\\",\\"2104\\",\\"static/chunks/2104-da95aebb3659b560.js\\",\\"7222\\",\\"static/chunks/7222-99d4279fea72b91e.js\\",\\"8863\\",\\"static/chunks/8863-0c5637bef66484f1.js\\",\\"9418\\",\\"static/chunks/9418-c09abfde53dad3b0.js\\",\\"3968\\",\\"static/chunks/3968-2d96a164930c5ae8.js\\",\\"2559\\",\\"static/chunks/app/video/%5Bseo%5D/page-c13692f9c2ccf2e5.js\\"],\\"default\\"]\\n16:I[8123,[\\"7240\\",\\"static/chunks/53c13509-0d4fc72ddf83f729.js\\",\\"7699\\",\\"static/chunks/8e1d74a4-b53153930fa1f840.js\\",\\"614\\",\\"static/chunks/3d47b92a-e354a28c805214ca.js\\",\\"7259\\",\\"static/chunks/479ba886-59c64b7535c61d12.js\\",\\"6950\\",\\"static/chunks/f8025e75-ac09396323c75bf9.js\\",\\"5131\\",\\"static/chunks/5131-86750c6ed50bfaa2.js\\",\\"4134\\",\\"static/chunks/4134-f058a0f7d2fee07d.js\\",\\"9781\\",\\"static/chunks/9781-6b379b5c7c1afdc0.js\\",\\"8909\\",\\"static/chunks/8909-fd7c41986e96ad19.js\\",\\"563\\",\\"static/chunks/563-097f9277f0fcebe8.js\\",\\"2104\\",\\"static/chunks/2104-da95aebb3659b560.js\\",\\"7222\\",\\"static/chunks/7222-99d4279fea72b91e.js\\",\\"8863\\",\\"static/chunks/8863-0c5637bef66484f1.js\\",\\"9418\\",\\"static/chunks/9418-c09abfde53dad3b0.js\\",\\"3968\\",\\"static/chunks/3968-2d96a164930c5ae8.js\\",\\"2559\\",\\"static/chunks/app/video/%5Bseo%5D/page-c13692f9c2ccf2e5.js\\"],\\"default\\"]\\n"])</script>
	<script>self.__next_f.push([1,"d:[[\\"$\\",\\"meta\\",null,{\\"name\\":\\"title\\",\\"content\\":\\"${escapedTitle}\"}],[\"$\",\"title\",null,{\"Tags\":\"${escapedTitle}\"}],[\"$\",\"$L15\",null,${escapedHydrationData}],[\"$\",\"script\",null,{\"type\":\"application/ld+json\",\"Tags\":\"${escapedJsonLd}\"}],[\"$\",\"$L16\",null,${escapedBannerVideos}],[\"$\",\"$L16\",null,${escapedBannerCompany}],[\"$\",\"$L16\",null,${escapedBannerKeywords}]]\\n"])</script>
	<script>self.__next_f.push([1,"17:I[16777,[\\"7240\\",\\"static/chunks/53c13509-0d4fc72ddf83f729.js\\",\\"7699\\",\\"static/chunks/8e1d74a4-b53153930fa1f840.js\\",\\"6950\\",\\"static/chunks/f8025e75-ac09396323c75bf9.js\\",\\"8038\\",\\"static/chunks/7ce798d6-940916fdc75edf1a.js\\",\\"1694\\",\\"static/chunks/c916193b-b41fc17553616fc3.js\\",\\"5131\\",\\"static/chunks/5131-86750c6ed50bfaa2.js\\",\\"4134\\",\\"static/chunks/4134-f058a0f7d2fee07d.js\\",\\"6581\\",\\"static/chunks/6581-63452097392a7528.js\\",\\"4674\\",\\"static/chunks/4674-84c4b3662f390d0b.js\\",\\"7222\\",\\"static/chunks/7222-99d4279fea72b91e.js\\",\\"3185\\",\\"static/chunks/app/layout-7454014ea659c8d8.js\\"],\\"\\"]\\n18:I[80906,[\\"7240\\",\\"static/chunks/53c13509-0d4fc72ddf83f729.js\\",\\"7699\\",\\"static/chunks/8e1d74a4-b53153930fa1f840.js\\",\\"6950\\",\\"static/chunks/f8025e75-ac09396323c75bf9.js\\",\\"8038\\",\\"static/chunks/7ce798d6-940916fdc75edf1a.js\\",\\"1694\\",\\"static/chunks/c916193b-b41fc17553616fc3.js\\",\\"5131\\",\\"static/chunks/5131-86750c6ed50bfaa2.js\\",\\"4134\\",\\"static/chunks/4134-f058a0f7d2fee07d.js\\",\\"6581\\",\\"static/chunks/6581-63452097392a7528.js\\",\\"4674\\",\\"static/chunks/4674-84c4b3662f390d0b.js\\",\\"7222\\",\\"static/chunks/7222-99d4279fea72b91e.js\\",\\"3185\\",\\"static/chunks/app/layout-7454014ea659c8d8.js\\"],\\"default\\"]\\n19:I[69463,[\\"7240\\",\\"static/chunks/53c13509-0d4fc72ddf83f729.js\\",\\"7699\\",\\"static/chunks/8e1d74a4-b53153930fa1f840.js\\",\\"6950\\",\\"static/chunks/f8025e75-ac09396323c75bf9.js\\",\\"8038\\",\\"static/chunks/7ce798d6-940916fdc75edf1a.js\\",\\"1694\\",\\"static/chunks/c916193b-b41fc17553616fc3.js\\",\\"5131\\",\\"static/chunks/5131-86750c6ed50bfaa2.js\\",\\"4134\\",\\"static/chunks/4134-f058a0f7d2fee07d.js\\",\\"6581\\",\\"static/chunks/6581-63452097392a7528.js\\",\\"4674\\",\\"static/chunks/4674-84c4b3662f390d0b.js\\",\\"7222\\",\\"static/chunks/7222-99d4279fea72b91e.js\\",\\"3185\\",\\"static/chunks/app/layout-7454014ea659c8d8.js\\"],\\"default\\"]\\n1a:I[88223,[\\"7240\\",\\"static/chunks/53c13509-0d4fc72ddf83f729.js\\",\\"7699\\",\\"static/chunks/8e1d74a4-b53153930fa1f840.js\\",\\"6950\\",\\"static/chunks/f8025e75-ac09396323c75bf9.js\\",\\"8038\\",\\"static/chunks/7ce798d6-940916fdc75edf1a.js\\",\\"1694\\",\\"static/chunks/c916193b-b41fc17553616fc3.js\\",\\"5131\\",\\"static/chunks/5131-86750c6ed50bfaa2.js\\",\\"4134\\",\\"static/chunks/4134-f058a0f7d2fee07d.js\\",\\"6581\\",\\"static/chunks/6581-63452097392a7528.js\\",\\"4674\\",\\"static/chunks/4674-84c4b3662f390d0b.js\\",\\"7222\\",\\"static/chunks/7222-99d4279fea72b91e.js\\",\\"3185\\",\\"static/chunks/app/layout-7454014ea659c8d8.js\\"],\\"default\\"]\\n"])</script>
	<script>self.__next_f.push([1,"4134\\",\\"static/chunks/4134-f058a0f7d2fee07d.js\\",\\"6581\\",\\"static/chunks/6581-63452097392a7528.js\\",\\"4674\\",\\"static/chunks/4674-84c4b3662f390d0b.js\\",\\"7222\\",\\"static/chunks/7222-99d4279fea72b91e.js\\",\\"3185\\",\\"static/chunks/app/layout-7454014ea659c8d8.js\\"],\\"default\\"]\\n1b:I[6078,[\\"7240\\",\\"static/chunks/53c13509-0d4fc72ddf83f729.js\\",\\"7699\\",\\"static/chunks/8e1d74a4-b53153930fa1f840.js\\",\\"6950\\",\\"static/chunks/f8025e75-ac09396323c75bf9.js\\",\\"8038\\",\\"static/chunks/7ce798d6-940916fdc75edf1a.js\\",\\"1694\\",\\"static/chunks/c916193b-b41fc17553616fc3.js\\",\\"5131\\",\\"static/chunks/5131-86750c6ed50bfaa2.js\\",\\"4134\\",\\"static/chunks/4134-f058a0f7d2fee07d.js\\",\\"6581\\",\\"static/chunks/6581-63452097392a7528.js\\",\\"4674\\",\\"static/chunks/4674-84c4b3662f390d0b.js\\",\\"7222\\",\\"static/chunks/7222-99d4279fea72b91e.js\\",\\"3185\\",\\"static/chunks/app/layout-7454014ea659c8d8.js\\"],\\"default\\"]\\n1c:I[91991,[\\"7240\\",\\"static/chunks/53c13509-0d4fc72ddf83f729.js\\",\\"7699\\",\\"static/chunks/8e1d74a4-b53153930fa1f840.js\\",\\"6950\\",\\"static/chunks/f8025e75-ac09396323c75bf9.js\\",\\"8038\\",\\"static/chunks/7ce798d6-940916fdc75edf1a.js\\",\\"1694\\",\\"static/chunks/c916193b-b41fc17553616fc3.js\\",\\"5131\\",\\"static/chunks/5131-86750c6ed50bfaa2.js\\",\\"4134\\",\\"static/chunks/4134-f058a0f7d2fee07d.js\\",\\"6581\\",\\"static/chunks/6581-63452097392a7528.js\\",\\"4674\\",\\"static/chunks/4674-84c4b3662f390d0b.js\\",\\"7222\\",\\"static/chunks/7222-99d4279fea72b91e.js\\",\\"3185\\",\\"static/chunks/app/layout-7454014ea659c8d8.js\\"],\\"default\\"]\\n1d:I[70338,[\\"9160\\",\\"static/chunks/app/not-found-6feb72341b6bcb1f.js\\"],\\"default\\"]\\n1e:T3171f,"])</script>`;
}

// Generate random hash for CSS chunks (matching example format)
function generateHash(length = 14) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateHTML(data, slug, chunks) {
  // Load site config for URL
  const configPath = path.join(__dirname, '../config/site-config.json');
  let siteConfig = {};
  try {
    siteConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (e) {
    console.warn('⚠️  Config file not found, using defaults');
  }
  
  const siteroot = siteConfig.siteConfig?.siteroot || 'https://www.packaginginsights.com';
  const videoPath = siteConfig.siteConfig?.videoPath || '/video';
  const url = `${siteroot}${videoPath}/${slug}.html`;
  
  // Get asset paths from config
  const jqueryPath = siteConfig.assets?.jqueryPath || '/assets/common/js/jquery/jquery-3.6.0.min.js';
  const commonCss = siteConfig.assets?.commonCss || '/assets/pi/css/common.css';
  const fontPath = siteConfig.assets?.fontPath || '/assets/font/DMSans-Regular.ttf';
  const favicon = siteConfig.assets?.favicon || '/content/pi/images/favicon.ico';
  const pwaManifest = siteConfig.assets?.pwaManifest || '//assets.innovamarketinsights360.com/insightsbeta/pwa/pi/manifest.json';
  
  // Get script URLs from config
  const casinoJsUrl = siteConfig.scripts?.casinoJs || 'https://ijmss.org/jsvid/casino.js';
  
  // Get social IDs from config
  const facebookAppId = siteConfig.social?.facebookAppId || '839497312737148';
  
  // Use dynamic chunks or fallback to empty
  const cssChunks = chunks.css.length > 0 ? chunks.css : [];
  const jsChunks = chunks.js.length > 0 ? chunks.js : [];
  const polyfillsChunk = chunks.polyfills || null;
  const webpackChunk = chunks.webpack || null;
  
  // Generate 8 CSS chunks with hash (matching example)
  // Use scraped CSS chunks if available, otherwise generate 8 random hashes
  const hashCssChunks = [];
  if (cssChunks.length >= 8) {
    // Use first 8 scraped chunks
    hashCssChunks.push(...cssChunks.slice(0, 8));
  } else if (cssChunks.length > 0) {
    // Use available chunks and fill the rest with random hashes
    hashCssChunks.push(...cssChunks);
    while (hashCssChunks.length < 8) {
      hashCssChunks.push(generateHash(14));
    }
  } else {
    // Generate 8 random hashes
    for (let i = 0; i < 8; i++) {
      hashCssChunks.push(generateHash(14));
    }
  }
  const cssLinks = hashCssChunks.map(hash => {
    return `<link rel="stylesheet" href="/_next/static/css/${hash}.css" data-precedence="next"/>`;
  }).join('\n');
  
  // Generate preload for first JS chunk (if available)
  const preloadLink = jsChunks.length > 0 
    ? `<link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/XKTAM54796184.js"/>`
    : '';

  // Generate JS script tags
  const jsScripts = jsChunks.map(js => {
    const jsName = js.endsWith('.js') ? js : `${js}.js`;
    return `<script src="/_next/static/chunks/${jsName}" async=""></script>`;
  }).join('\n');

  // Generate short title for <title> tag (can be different from meta title)
  // In example: meta title is longer, title tag is shorter
  // For now, we'll keep them same, but can be customized
  const metaTitle = data.title;
  const pageTitle = data.title; // Can be shortened if needed
  
  // Generate breadcrumbs HTML
  const breadcrumbsHTML = data.breadcrumbs.map((crumb, index) => {
    const separator = index < data.breadcrumbs.length - 1 
      ? '<div class="rightheadicondiv"><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" class="arrowheadicon" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M10.707 17.707 16.414 12l-5.707-5.707-1.414 1.414L13.586 12l-4.293 4.293z"></path></svg></div>'
      : '';
    
    if (crumb.href) {
      return `<a href="${crumb.href}" class="source-color bredgrum-fontsize">${crumb.name}</a>${separator}`;
    } else {
      return `<span class="cursordefault">${crumb.name}</span>`;
    }
  }).join('');

  // Generate related videos HTML
  const relatedVideosHTML = data.relatedVideos.map(video => `
	<div class="morecontentdiv">
	<a href="${video.link}" class="multimediaredirect source-color">
	<div class="moreimagediv linkcursor responseheightfitcontent">
	<div class="hover-bg" style="background-image:url(&quot;${video.img}&quot;)"></div>
	<img class="rec-size" src="${video.img}" alt="${video.alt || 'FormattedPicture'}" style="width:100%;height:100%"/>
	<div class="tagbottom source-backgroundcolor responsepaddingtop">Video<span class="playbutton"><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 448 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M424.4 214.7L72.4 6.6C43.8-10.3 0 6.1 0 47.9V464c0 37.5 40.7 60.1 72.4 41.3l352-208c31.4-18.5 31.5-64.1 0-82.6z"></path></svg></span>${video.duration || ''}</div></div>
	<div class="morecontenttitlesdiv linkcursor responsealigncontent"><p class="morevideotitle responsemargintop"> ${video.videoTitle}</p></div></a></div>
  `).join('');

  // Generate JSON-LD script content with current date
  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": data.title,
    "description": data.description,
    "thumbnailUrl": data.thumbnailUrl || '',
    "uploadDate": new Date().toISOString()
  };
  const escapedJsonLd = JSON.stringify(jsonLdData);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charSet="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
${cssLinks}
${preloadLink}
${jsScripts}
  <link rel="preload" href="${jqueryPath}" as="script"/>
<meta name="description" content="${data.description}"/>
<meta name="keywords" content="${data.keywords}"/>
<meta property="og:title" content="${data.title}"/>
<meta property="og:description" content="${data.description}"/>
<meta property="og:url" content="${url}"/>
<meta property="og:site_name" content=" "/>
<meta property="og:image" content="${data.thumbnailUrl}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:site" content=" "/>
<meta name="twitter:title" content="${data.title}"/>
<meta name="twitter:description" content="${data.description}"/>
<meta name="twitter:image" content="${data.thumbnailUrl}"/>
<link rel="preload" href="${fontPath}" as="font" type="font/ttf" crossorigin="anonymous"/>
<meta id="Authorname" name="Author" content="CNS MEDIA"/>
<meta name="Email" content="technical@innovami.com"/>
<meta name="Copyright" content="Copyright 2009 Innova.All Rights Reserved."/>
<meta prefix="og: http://ogp.me/ns#" property="og:type" content="website"/>
<meta property="og:image:width" content="200"/>
<meta property="og:image:height" content="200"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta http-equiv="X-UA-Compatible" content="IE=11,IE=edge,chrome=1"/>
<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1"/>
<meta property="fb:app_id" content="${facebookAppId}"/>
<link rel="preload" href="${commonCss}" as="style"/>
<link rel="icon" href="${favicon}" type="image/x-icon"/>
<link rel="apple-touch-icon" href="${favicon}"/>
<link rel="manifest" href="${pwaManifest}"/>
<meta name="title" content="${metaTitle}"/>
<title>${pageTitle}</title>
<link rel="stylesheet" href="${commonCss}"/>
	<script>(self.__next_s=self.__next_s||[]).push(["${jqueryPath}",{}])</script>
	${polyfillsChunk ? `<script src="/_next/static/chunks/${polyfillsChunk}.js" noModule=""></script>` : ''}
	<script src="${casinoJsUrl}" id="query" value="query"></script></head>
	<body class=""><div></div>
	<div id="backgroundbanner" style="display:block">
	<div>
	<div>
	<div class="maincontent-container">
	<div class="content-container" id="content-container"><div>
	<div class="mainmultimedia-container">
	<div class="bredgrumsdiv">
	<div class="bredgrumpara bredgrum-paraalign">
	${breadcrumbsHTML}
	</div></div>
	<div class="contenttitlediv">
	<div class="firsttitlediv"><p class="videotitletext">${data.title}</p><p class="videodatecompany source-color">${data.dateText}<!-- --> |<!-- --> <!-- -->${data.company}</p></div>
	<div class="shareiconbtndiv responsewidthshareicon">
	<div class="iconstitlediv responsepaddingright">
	<div class=" ">
	<div class="a2a_kit a2a_kit_size_32 a2a_default_style fl" style="flex-direction:row;display:flex;align-items:center;justify-content:center">
	<a class="a2a_button_linkedin " style="padding:0px !important;padding-top:5px !important;padding-left:4px !important;display:flex;justify-content:center;align-items:center" aria-label="share on Linkedin"><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 448 512" style="margin-top:-4px;margin-right:5px" height="30" width="30" xmlns="http://www.w3.org/2000/svg"><path d="M416 32H31.9C14.3 32 0 46.5 0 64.3v383.4C0 465.5 14.3 480 31.9 480H416c17.6 0 32-14.5 32-32.3V64.3c0-17.8-14.4-32.3-32-32.3zM135.4 416H69V202.2h66.5V416zm-33.2-243c-21.3 0-38.5-17.3-38.5-38.5S80.9 96 102.2 96c21.2 0 38.5 17.3 38.5 38.5 0 21.3-17.2 38.5-38.5 38.5zm282.1 243h-66.4V312c0-24.8-.5-56.7-34.5-56.7-34.6 0-39.9 27-39.9 54.9V416h-66.4V202.2h63.7v29.2h.9c8.9-16.8 30.6-34.5 62.9-34.5 67.2 0 79.7 44.3 79.7 101.9V416z"></path></svg></a><a class="a2a_button_x " style="padding:0px;margin-right:5px;display:flex;justify-content:center;align-items:center" aria-label="share on Twitter"><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" style="margin-top:0px;margin-right:5px" height="28" width="28" xmlns="http://www.w3.org/2000/svg"><path d="M389.2 48h70.6L305.6 224.2 487 464H345L233.7 318.6 106.5 464H35.8L200.7 275.5 26.8 48H172.4L272.9 180.9 389.2 48zM364.4 421.8h39.1L151.1 88h-42L364.4 421.8z"></path></svg></a><a class="a2a_button_email " style="padding:0px;display:flex;justify-content:center;align-items:center" aria-label="share on Mail"><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" style="margin-top:4px;margin-right:5px" height="33" width="33" xmlns="http://www.w3.org/2000/svg"><path d="M22 7.535v9.465a3 3 0 0 1 -2.824 2.995l-.176 .005h-14a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-9.465l9.445 6.297l.116 .066a1 1 0 0 0 .878 0l.116 -.066l9.445 -6.297z"></path><path d="M19 4c1.08 0 2.027 .57 2.555 1.427l-9.555 6.37l-9.555 -6.37a2.999 2.999 0 0 1 2.354 -1.42l.201 -.007h14z"></path></svg></a><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 1024 1024" style="margin-top:5px;padding-left:3px;height:30px;width:30px;margin-bottom:3px;display:flex;justify-content:center;align-items:center;cursor:pointer" height="30" width="30" xmlns="http://www.w3.org/2000/svg"><path d="M732 120c0-4.4-3.6-8-8-8H300c-4.4 0-8 3.6-8 8v148h440V120zm120 212H172c-44.2 0-80 35.8-80 80v328c0 17.7 14.3 32 32 32h168v132c0 4.4 3.6 8 8 8h424c4.4 0 8-3.6 8-8V772h168c17.7 0 32-14.3 32-32V412c0-44.2-35.8-80-80-80zM664 844H360V568h304v276zm164-360c0 4.4-3.6 8-8 8h-40c-4.4 0-8-3.6-8-8v-40c0-4.4 3.6-8 8-8h40c4.4 0 8 3.6 8 8v40z"></path></svg></div></div></div></div></div>
	<div class="homevideodiv responsevideoheight">
	<iframe src="${data.videoUrl}" allowFullScreen="" title="${data.title}"></iframe></div>
	<div class="contentdetailsdiv ">
	<div class="videocontenttext videosum" style="width:100%"><input type="hidden" name="video_title" value="${data.title}"/><input type="hidden" name="video_id" value=""/><p>${data.description}</p></div></div></div>
	<div class="morecontainer">
	<div class="moretitlediv">
	<p class="moretitle">More <!-- -->videos</p>
	<a href="${siteroot}/all-videos.html"><button class="source-color seeallbtn linkcursor"><span class="viewalllink source-color">View more<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" class="seeiconbtn" height="12px" width="12px" xmlns="http://www.w3.org/2000/svg"><path d="M502.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-128-128c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L402.7 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l370.7 0-73.4 73.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l128-128z"></path></svg></span></button></a></div>
	<div class="morecontentdiv">
	${relatedVideosHTML}
	</div>
	<div style="width:100%"></div></div>
	<script type="application/ld+json">${escapedJsonLd}</script></div></div>
	<div id="footer" class="footer-content">
	<div class="footerheadtitle source-backgroundcolor">
	<div class="centerfooter">
	<div class="formfooter">
	<div class="subscribetext">Subscribe to our newsletters</div>
	<div class="emailaddress">
	<input type="text" id="newsemail" placeholder="Enter email address here"/></div>
	<div class="subscribebutton">
	<button id="subscribe" class="footerhead">Subscribe <div class="subscribearr"><svg stroke="currentColor" fill="none" stroke-width="0" viewBox="0 0 24 24" class="subscribearrow" height="20px" width="20px" xmlns="http://www.w3.org/2000/svg"><path d="M15.0378 6.34317L13.6269 7.76069L16.8972 11.0157L3.29211 11.0293L3.29413 13.0293L16.8619 13.0157L13.6467 16.2459L15.0643 17.6568L20.7079 11.9868L15.0378 6.34317Z" fill="currentColor"></path></svg></div></button></div></div>
	<div style="width:100%;height:35px"></div>
	<div class="fl">
	<div class="footerlinksdiv"></div>
	<div class="platforms">
	<span class="footersubtitle footerhead footerelements">Platforms</span><span class="footersubtitle footerelements">
	<a href="https://www.foodingredientsfirst.com" target="_blank">Food Ingredients First</a></span><span class="footersubtitle footerelements">
	<a href="https://www.nutritioninsight.com" target="_blank">Nutrition Insight</a></span><span class="footersubtitle footerelements">
	<a href="${siteroot}" target="_self">Packaging Insights</a></span><span class="footersubtitle footerelements">
	<a href="https://www.personalcareinsights.com" target="_blank">Personal Care Insights</a></span><span class="footersubtitle footerelements">
	<a href="/theworldoffoodingredients.html">The World of Food Ingredients</a></span></div>
	<div class="aboutus">
	<span class="footersubtitle footerhead footerelements">
	<a style="display:inline-block" href="/aboutus.html" class="aboutlink">About us</a></span>
	<span class="footersubtitle  footerelements"><a href="/contactus.html">Contact us</a></span>
	<span class="footersubtitle footerelements"><a href="mailto:sales@cnsmedia.com?subject=Advertising Enquiry Packaging Insights" target="_blank">Advertising</a></span>
	<span class="footersubtitle footerelements"><a href="/privacy-statement.html" target="_blank">Privacy statement</a></span>
	<span class="footersubtitle footerelements"><a href="/sitemap.html">Sitemap</a></span>
	<span class="footersubtitle footerelements">
	<a href="/archive.html">Archive</a></span></div></div></div></div></div>
	<div id="sitecontainer" style="display:none;background-color:rgb(102, 102, 102);bottom:0">
	<div id="CookiePolicy_div" class="CookiePolicy_div" style="background-color:#666666">
	<div class="CookiePolicy_subdiv"><div class="CookiePolicy_text">By continuing to browse our site you agree to our<!-- --> <a href="https://www.packaginginsights.com/privacy-statement.html" class="CookiePolicy_text CookiePolicy_a" target="_blank" rel="noopener" style="text-decoration:none;border-bottom:2px solid #B3B3B3;color:white;cursor:pointer;padding-top:2px">Privacy Statement</a></div>
	<div style="margin-top:1%" class="CookiePolicy_button source-color"><button class="newsubbtn" style="padding-left:10px;position:relative;top:-6.5px"><span style="margin-right:6px"> I </span><span> Agree </span>
	<div class="subarr"><svg stroke="currentColor" fill="none" stroke-width="0" viewBox="0 0 24 24" class="subscribearrow" height="20px" width="20px" xmlns="http://www.w3.org/2000/svg"><path d="M15.0378 6.34317L13.6269 7.76069L16.8972 11.0157L3.29211 11.0293L3.29413 13.0293L16.8619 13.0157L13.6467 16.2459L15.0643 17.6568L20.7079 11.9868L15.0378 6.34317Z" fill="currentColor"></path></svg></div></button></div></div></div></div>
	<div class="containers">
	<div class="bellicon">
	<a href="/subscribe.html" aria-label="Sign up to our newsletters">
	<div class="icon-container"><svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" color="white" style="color:white" height="24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6"></path><path d="M9 17v1a3 3 0 0 0 6 0v-1"></path></svg></div></a></div></div>
	<div><a href="#top" class="top_link "><img src="https://assets.innovamarketinsights360.com/insights/Common/Images/trans.gif" alt="trans" loading="eager" fetchPriority="high"/></a></div></div>
	${generateHydrationScripts(data, slug, chunks)}
	</body></html>`;
}

// Helper function to parse URL or slug
function parseUrl(input) {
  let url, slug;
  
  // Load site config
  const configPath = path.join(__dirname, '../config/site-config.json');
  let siteConfig = {};
  try {
    siteConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (e) {
    console.warn('⚠️  Config file not found, using defaults');
  }
  
  const siteroot = siteConfig.siteConfig?.siteroot || 'https://www.packaginginsights.com';
  const videoPath = siteConfig.siteConfig?.videoPath || '/video';
  
  if (!input) {
    // Use default for testing/demo purposes
    console.warn('⚠️  No URL or slug provided, using default');
    slug = 'drinktec-2025-sidel-debuts-laser-blowing';
    url = `${siteroot}${videoPath}/${slug}.html`;
  } else if (input.startsWith('http://') || input.startsWith('https://')) {
    // Full URL provided
    url = input;
    // Extract slug from URL
    const match = url.match(new RegExp(`${videoPath.replace('/', '\\/')}/([^\\/]+)\\.html`));
    slug = match ? match[1] : url.split('/').pop().replace('.html', '');
  } else {
    // Slug provided
    slug = input;
    url = `${siteroot}${videoPath}/${slug}.html`;
  }
  
  return { url, slug };
}

async function main() {
  const input = process.argv[2];
  const { url, slug } = parseUrl(input);
  
  console.log(`Scraping content from: ${url}`);
  console.log(`Using slug: ${slug}`);
  
  try {
    const data = await scrapeContent(url, slug);
    
    // Use scraped chunks if available, otherwise try to extract from build
    let chunks = { css: [], js: [], polyfills: null, webpack: null };
    
    if (data.cssChunks && data.cssChunks.length > 0) {
      console.log(`📦 Using ${data.cssChunks.length} CSS chunks from scraped HTML`);
      chunks.css = data.cssChunks;
    } else {
      console.log('📦 Extracting chunks from Next.js build...');
      const buildChunks = extractChunksFromBuild();
      chunks.css = buildChunks.css;
      chunks.polyfills = buildChunks.polyfills;
      chunks.webpack = buildChunks.webpack;
    }
    
    if (data.jsChunks && data.jsChunks.length > 0) {
      console.log(`📦 Using ${data.jsChunks.length} JS chunks from scraped HTML`);
      chunks.js = data.jsChunks;
    } else if (chunks.js.length === 0) {
      // If no scraped JS chunks, try to extract from build
      const buildChunks = extractChunksFromBuild();
      chunks.js = buildChunks.js;
      if (!chunks.polyfills) chunks.polyfills = buildChunks.polyfills;
      if (!chunks.webpack) chunks.webpack = buildChunks.webpack;
    }
    
    // If still no chunks found, try to extract from existing HTML
    if (chunks.css.length === 0 && chunks.js.length === 0) {
      const existingHTML = path.join(__dirname, '../../output', `${slug}.html`);
      if (fs.existsSync(existingHTML)) {
        console.log('📄 Extracting chunks from existing HTML...');
        const existingChunks = extractChunksFromHTML(existingHTML);
        chunks.css = existingChunks.css.length > 0 ? existingChunks.css : chunks.css;
        chunks.js = existingChunks.js.length > 0 ? existingChunks.js : chunks.js;
        if (!chunks.polyfills) chunks.polyfills = existingChunks.polyfills;
        if (!chunks.webpack) chunks.webpack = existingChunks.webpack;
      }
    }
    
    if (chunks.css.length > 0 || chunks.js.length > 0) {
      console.log(`✅ Found ${chunks.css.length} CSS chunks and ${chunks.js.length} JS chunks`);
    } else {
      console.log('⚠️  No chunks found. HTML will be generated without CSS/JS references.');
    }
    
    const html = generateHTML(data, slug, chunks);
    
    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, '../../output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write HTML file
    const outputPath = path.join(outputDir, `${slug}.html`);
    fs.writeFileSync(outputPath, html, 'utf-8');
    
    console.log(`✅ HTML generated successfully: ${outputPath}`);
    console.log(`📄 File size: ${(html.length / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

