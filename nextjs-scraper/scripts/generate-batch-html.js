const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load environment variables from .env file if exists
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {
  // dotenv not installed or .env not found, continue without it
}

// Import functions from generate-dynamic-html.js
const generateDynamicScriptPath = path.join(__dirname, 'generate-dynamic-html.js');

// Configuration
const CONFIG = {
  maxWorkers: 1, // Default: sequential processing (safe for process spawning)
};

// Get maxWorkers from environment variable or use CONFIG default
function getMaxWorkers() {
  const envWorkers = process.env.MAX_WORKERS;
  if (envWorkers) {
    const parsed = parseInt(envWorkers, 10);
    if (!isNaN(parsed) && parsed > 0) {
      // Validate: min 1, max 100
      return Math.max(1, Math.min(parsed, 100));
    }
  }
  return CONFIG.maxWorkers;
}

// Get validated maxWorkers
const MAX_WORKERS = getMaxWorkers();

// We'll use a simpler approach: call the main script for each keyword
// This way we can reuse all the logic

async function processBatchFromFile(keywordsFilePath) {
  const ext = path.extname(keywordsFilePath).toLowerCase();
  
  if (!fs.existsSync(keywordsFilePath)) {
    console.error(`❌ File not found: ${keywordsFilePath}`);
    process.exit(1);
  }
  
  console.log(`📋 Processing keywords from: ${keywordsFilePath}`);
  
  let keywords = [];
  
  try {
    if (ext === '.csv') {
      // Read CSV file
      const csv = require('csv-parser');
      keywords = await new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(keywordsFilePath)
          .pipe(csv())
          .on('data', (data) => {
            const keyword = data.keyword?.trim();
            if (keyword) {
              results.push(keyword);
            }
          })
          .on('end', () => resolve(results))
          .on('error', reject);
      });
    } else if (ext === '.xlsx' || ext === '.xls') {
      // Read XLSX file
      const XLSX = require('xlsx');
      const workbook = XLSX.readFile(keywordsFilePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      keywords = data
        .map(row => (row.keyword || row.KEYWORD)?.trim())
        .filter(keyword => keyword);
    } else {
      console.error(`❌ Unsupported file format: ${ext}`);
      console.log('💡 Supported formats: .csv, .xlsx, .xls');
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error reading file: ${error.message}`);
    process.exit(1);
  }
  
  if (keywords.length === 0) {
    console.error('❌ No keywords found in file');
    process.exit(1);
  }
  
  console.log(`✅ Found ${keywords.length} keywords to process`);
  console.log(`⚙️  Workers: ${MAX_WORKERS} ${MAX_WORKERS > 1 ? '(parallel)' : '(sequential)'}\n`);
  
  // Process each keyword
  let successCount = 0;
  let failCount = 0;
  const failedKeywords = [];
  
  // Promisified execSync wrapper for parallel processing
  const processKeyword = async (keyword, index) => {
    const progress = `[${index + 1}/${keywords.length}]`;
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`${progress} Processing: "${keyword}"`);
    console.log('='.repeat(80));
    
    try {
      // Call the generate-dynamic-html.js script with the keyword
      execSync(`node ${generateDynamicScriptPath} "${keyword}"`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      
      console.log(`✅ ${progress} Successfully processed: "${keyword}"`);
      return { success: true, keyword, index };
    } catch (error) {
      console.error(`❌ ${progress} Failed to process: "${keyword}"`);
      console.error(`   Error: ${error.message}`);
      return { success: false, keyword, index, error: error.message };
    }
  };
  
  if (MAX_WORKERS > 1) {
    // Parallel processing with worker limit
    const processKeywordPromises = [];
    const activeWorkers = [];
    let keywordIndex = 0;
    
    while (keywordIndex < keywords.length || activeWorkers.length > 0) {
      // Start new workers up to limit
      while (activeWorkers.length < MAX_WORKERS && keywordIndex < keywords.length) {
        const keyword = keywords[keywordIndex];
        const index = keywordIndex;
        keywordIndex++;
        
        const worker = processKeyword(keyword, index).then(result => {
          // Remove from active workers when done
          const workerIndex = activeWorkers.indexOf(worker);
          if (workerIndex > -1) {
            activeWorkers.splice(workerIndex, 1);
          }
          
          // Update counters
          if (result.success) {
            successCount++;
          } else {
            failCount++;
            failedKeywords.push(result.keyword);
          }
          
          return result;
        });
        
        activeWorkers.push(worker);
        processKeywordPromises.push(worker);
      }
      
      // Wait for at least one worker to complete
      if (activeWorkers.length > 0) {
        await Promise.race(activeWorkers);
      }
    }
    
    // Wait for all remaining workers to complete
    await Promise.all(activeWorkers);
  } else {
    // Sequential processing (original logic)
    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];
      const result = await processKeyword(keyword, i);
      
      if (result.success) {
        successCount++;
      } else {
        failCount++;
        failedKeywords.push(result.keyword);
      }
    }
  }
  
  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 BATCH PROCESSING SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Success: ${successCount}/${keywords.length}`);
  console.log(`❌ Failed: ${failCount}/${keywords.length}`);
  
  if (failedKeywords.length > 0) {
    console.log(`\n❌ Failed keywords:`);
    failedKeywords.forEach(kw => console.log(`   - ${kw}`));
  }
  
  console.log(`\n✅ Batch processing completed!`);
}

// Main
async function main() {
  const keywordsFile = process.argv[2];
  
  if (!keywordsFile) {
    console.error('❌ Usage: node generate-batch-html.js <keywords-file>');
    console.log('\n💡 Example:');
    console.log('   node generate-batch-html.js config/keywords.csv');
    console.log('   node generate-batch-html.js config/keywords.xlsx');
    process.exit(1);
  }
  
  const keywordsFilePath = path.isAbsolute(keywordsFile) 
    ? keywordsFile 
    : path.join(__dirname, '..', keywordsFile);
  
  await processBatchFromFile(keywordsFilePath);
}

main().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});

