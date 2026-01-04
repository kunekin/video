const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const OpenAI = require('openai');

// Load environment variables from .env file if exists
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {
  // dotenv not installed or .env not found, continue without it
}

// Load AI prompts config
const aiPrompts = require('../config/ai-prompts');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configuration
const CONFIG = {
  keywordsPerCall: 5, // Number of keywords per API call (reduced for better JSON reliability)
  variationsPerKeyword: 20, // Number of variations to generate per keyword (reduced for better JSON reliability)
  batchSize: 100, // Save checkpoint every N keywords
  maxWorkers: 5, // Number of parallel API calls
  rateLimitDelay: 100, // Delay between API calls (ms) to respect rate limits
};

// Generate variations for multiple keywords in one API call
async function generateVariationsBatch(keywords, retries = 3) {
  const prompt = `Generate ${CONFIG.variationsPerKeyword} SEO-optimized content variations for each of the following keywords: ${keywords.join(', ')}

For each keyword, generate ${CONFIG.variationsPerKeyword} unique variations. Each variation must include:
1. TITLE (60-70 characters, SEO-optimized, unique per variation)
2. META DESCRIPTION (155-160 characters, for search engine results)
3. OG DESCRIPTION (200 characters, for social media)
4. TWITTER DESCRIPTION (200 characters, for Twitter cards)
5. PARAGRAPH CONTENT (250-350 characters, for visible content)
6. KEYWORDS (5-10 keywords, comma-separated)

Return ONLY a valid JSON object with this structure:
{
  "results": [
    {
      "keyword": "keyword1",
      "variations": [
        {
          "title": "Variation 1 title",
          "meta_description": "Meta description 1",
          "og_description": "OG description 1",
          "twitter_description": "Twitter description 1",
          "paragraph_content": "Paragraph content 1",
          "keywords": "keyword1, related1, related2"
        },
        ... (${CONFIG.variationsPerKeyword} variations)
      ]
    },
    {
      "keyword": "keyword2",
      "variations": [...]
    }
  ]
}

Each variation must be unique but related to its keyword. Focus on SEO optimization, keyword placement, and search intent.`;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: aiPrompts.contentGeneration.model || 'gpt-4o-mini',
        temperature: 0.5, // Lower temperature for more consistent JSON output
        max_tokens: 8000, // Increased for more variations
        messages: [
          {
            role: 'system',
            content: 'You are an SEO expert. Generate unique, SEO-optimized content variations. Always return valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content;
      const parsed = JSON.parse(content);

      // Validate structure
      if (!parsed.results || !Array.isArray(parsed.results)) {
        throw new Error('Invalid response structure: missing results array');
      }

      // Validate each keyword has variations
      for (const result of parsed.results) {
        if (!result.keyword || !result.variations || !Array.isArray(result.variations)) {
          throw new Error(`Invalid result structure for keyword: ${result.keyword}`);
        }
        if (result.variations.length < CONFIG.variationsPerKeyword * 0.8) {
          console.warn(`⚠️  Keyword "${result.keyword}" only got ${result.variations.length} variations (expected ${CONFIG.variationsPerKeyword})`);
        }
      }

      return parsed.results;
    } catch (error) {
      if (attempt === retries - 1) {
        throw error;
      }
      console.warn(`⚠️  Attempt ${attempt + 1} failed, retrying... (${error.message})`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
    }
  }
}

// Load keywords from file
async function loadKeywordsFromFile(keywordsFilePath) {
  const ext = path.extname(keywordsFilePath).toLowerCase();
  const keywords = [];

  if (ext === '.csv') {
    return new Promise((resolve, reject) => {
      fs.createReadStream(keywordsFilePath)
        .pipe(csv())
        .on('data', (row) => {
          const keyword = row.keyword?.trim();
          if (keyword) {
            keywords.push(keyword);
          }
        })
        .on('end', () => resolve(keywords))
        .on('error', reject);
    });
  } else if (ext === '.xlsx' || ext === '.xls') {
    const workbook = XLSX.readFile(keywordsFilePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    data.forEach(row => {
      const keyword = (row.keyword || row.KEYWORD)?.trim();
      if (keyword) {
        keywords.push(keyword);
      }
    });
    
    return keywords;
  } else {
    throw new Error(`Unsupported file format: ${ext}`);
  }
}

// Save variations to CSV
function saveVariationsToCSV(variations, outputPath) {
  const headers = ['keyword', 'variation_id', 'title', 'meta_description', 'og_description', 'twitter_description', 'paragraph_content', 'keywords'];
  
  // Check if file exists to append or create new
  const fileExists = fs.existsSync(outputPath);
  const writeStream = fs.createWriteStream(outputPath, { flags: fileExists ? 'a' : 'w' });
  
  // Write headers if new file
  if (!fileExists) {
    writeStream.write(headers.join(',') + '\n');
  }
  
  // Write variations
  for (const result of variations) {
    for (let i = 0; i < result.variations.length; i++) {
      const variation = result.variations[i];
      const row = [
        `"${result.keyword}"`,
        i + 1,
        `"${variation.title.replace(/"/g, '""')}"`,
        `"${variation.meta_description.replace(/"/g, '""')}"`,
        `"${variation.og_description.replace(/"/g, '""')}"`,
        `"${variation.twitter_description.replace(/"/g, '""')}"`,
        `"${variation.paragraph_content.replace(/"/g, '""')}"`,
        `"${variation.keywords.replace(/"/g, '""')}"`,
      ];
      writeStream.write(row.join(',') + '\n');
    }
  }
  
  writeStream.end();
}

// Load checkpoint
function loadCheckpoint(checkpointPath) {
  if (!fs.existsSync(checkpointPath)) {
    return { processed: [], failed: [] };
  }
  try {
    const data = fs.readFileSync(checkpointPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.warn('⚠️  Error loading checkpoint, starting fresh');
    return { processed: [], failed: [] };
  }
}

// Save checkpoint
function saveCheckpoint(checkpointPath, checkpoint) {
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2), 'utf-8');
}

// Process keywords in batches with rate limiting
async function processKeywordsBatch(keywords, outputPath, checkpointPath) {
  const checkpoint = loadCheckpoint(checkpointPath);
  const processedSet = new Set(checkpoint.processed);
  const failedSet = new Set(checkpoint.failed);
  
  // Filter out already processed keywords
  const remainingKeywords = keywords.filter(kw => !processedSet.has(kw) && !failedSet.has(kw));
  
  if (remainingKeywords.length === 0) {
    console.log('✅ All keywords already processed!');
    return;
  }
  
  console.log(`📋 Total keywords: ${keywords.length}`);
  console.log(`✅ Already processed: ${checkpoint.processed.length}`);
  console.log(`❌ Failed: ${checkpoint.failed.length}`);
  console.log(`🔄 Remaining: ${remainingKeywords.length}\n`);
  
  // Process in batches
  const batches = [];
  for (let i = 0; i < remainingKeywords.length; i += CONFIG.keywordsPerCall) {
    batches.push(remainingKeywords.slice(i, i + CONFIG.keywordsPerCall));
  }
  
  console.log(`📦 Processing ${batches.length} batches (${CONFIG.keywordsPerCall} keywords per batch)...\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  // Process batches with rate limiting
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNum = i + 1;
    
    console.log(`[${batchNum}/${batches.length}] Processing batch: ${batch.join(', ')}`);
    
    try {
      const results = await generateVariationsBatch(batch);
      
      // Save to CSV
      saveVariationsToCSV(results, outputPath);
      
      // Update checkpoint
      for (const keyword of batch) {
        checkpoint.processed.push(keyword);
        processedSet.add(keyword);
      }
      
      successCount += batch.length;
      
      // Save checkpoint every batch
      saveCheckpoint(checkpointPath, checkpoint);
      
      console.log(`✅ Batch ${batchNum} completed: ${batch.length} keywords, ${results.reduce((sum, r) => sum + r.variations.length, 0)} variations generated`);
      
      // Rate limiting delay
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.rateLimitDelay));
      }
    } catch (error) {
      console.error(`❌ Batch ${batchNum} failed: ${error.message}`);
      
      // Mark all keywords in batch as failed
      for (const keyword of batch) {
        checkpoint.failed.push(keyword);
        failedSet.add(keyword);
      }
      
      failCount += batch.length;
      saveCheckpoint(checkpointPath, checkpoint);
    }
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Success: ${successCount} keywords`);
  console.log(`❌ Failed: ${failCount} keywords`);
  console.log(`📄 Output: ${outputPath}`);
  console.log(`💾 Checkpoint: ${checkpointPath}`);
}

// Main function
async function main() {
  const keywordsFile = process.argv[2];
  const outputFile = process.argv[3] || 'config/keywords-variations.csv';
  
  if (!keywordsFile) {
    console.error('❌ Usage: node generate-csv-variations.js <keywords-file> [output-file]');
    console.log('\n💡 Example:');
    console.log('   node generate-csv-variations.js config/keywords.csv');
    console.log('   node generate-csv-variations.js config/keywords.csv config/variations.csv');
    process.exit(1);
  }
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }
  
  const keywordsFilePath = path.isAbsolute(keywordsFile)
    ? keywordsFile
    : path.join(__dirname, '..', keywordsFile);
  
  const outputPath = path.isAbsolute(outputFile)
    ? outputFile
    : path.join(__dirname, '..', outputFile);
  
  const checkpointPath = outputPath.replace('.csv', '.checkpoint.json');
  
  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  console.log('='.repeat(80));
  console.log('🚀 CSV VARIATIONS GENERATOR');
  console.log('='.repeat(80));
  console.log(`📋 Keywords file: ${keywordsFilePath}`);
  console.log(`📄 Output file: ${outputPath}`);
  console.log(`💾 Checkpoint file: ${checkpointPath}`);
  console.log(`⚙️  Config: ${CONFIG.keywordsPerCall} keywords/batch, ${CONFIG.variationsPerKeyword} variations/keyword`);
  console.log('='.repeat(80) + '\n');
  
  try {
    // Load keywords
    console.log('📖 Loading keywords...');
    const keywords = await loadKeywordsFromFile(keywordsFilePath);
    console.log(`✅ Loaded ${keywords.length} keywords\n`);
    
    // Process keywords
    await processKeywordsBatch(keywords, outputPath, checkpointPath);
    
    console.log('\n✅ CSV variations generation completed!');
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

main();

