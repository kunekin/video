const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { EC2Client, StopInstancesCommand, DescribeInstancesCommand } = require('@aws-sdk/client-ec2');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import functions from generate-dynamic-html.js
const generateDynamicScriptPath = path.join(__dirname, 'generate-dynamic-html.js');

// Configuration
const CONFIG = {
  maxWorkers: 1, // Default: sequential processing (safe for process spawning)
  outputDir: process.env.OUTPUT_DIR || path.join(__dirname, '../../output'),
  s3Bucket: process.env.S3_BUCKET_NAME || '',
  s3Prefix: process.env.S3_PREFIX || '',
  s3Region: process.env.AWS_REGION || 'us-east-1',
  ec2InstanceId: process.env.EC2_INSTANCE_ID || '',
  ec2Region: process.env.AWS_REGION || 'us-east-1',
  stopEC2: process.env.STOP_EC2 !== 'false', // Default: true
};

// Get maxWorkers from environment variable or use CONFIG default
function getMaxWorkers() {
  const envWorkers = process.env.MAX_WORKERS;
  if (envWorkers) {
    const parsed = parseInt(envWorkers, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return Math.max(1, Math.min(parsed, 100));
    }
  }
  return CONFIG.maxWorkers;
}

const MAX_WORKERS = getMaxWorkers();

// Initialize AWS clients
const ec2Client = new EC2Client({
  region: CONFIG.ec2Region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const s3Client = new S3Client({
  region: CONFIG.s3Region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Get EC2 instance ID from metadata (if running on EC2)
async function getEC2InstanceId() {
  // If instance ID is provided in env, use it
  if (CONFIG.ec2InstanceId) {
    return CONFIG.ec2InstanceId;
  }

  // Try to get from EC2 instance metadata
  try {
    const http = require('http');
    return new Promise((resolve, reject) => {
      const options = {
        hostname: '169.254.169.254',
        port: 80,
        path: '/latest/meta-data/instance-id',
        timeout: 2000,
      };

      const req = http.get(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve(data.trim());
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
    });
  } catch (error) {
    return null;
  }
}

// Stop EC2 instance
async function stopEC2Instance(instanceId) {
  if (!instanceId) {
    console.log('⚠️  EC2 Instance ID not found. Skipping stop.');
    return { success: false, message: 'Instance ID not found' };
  }

  try {
    console.log(`🛑 Stopping EC2 instance: ${instanceId}...`);
    
    const command = new StopInstancesCommand({
      InstanceIds: [instanceId],
    });

    const response = await ec2Client.send(command);
    
    if (response.StoppingInstances && response.StoppingInstances.length > 0) {
      const instance = response.StoppingInstances[0];
      console.log(`✅ EC2 instance stop initiated: ${instanceId}`);
      console.log(`   Current State: ${instance.CurrentState?.Name}`);
      console.log(`   Previous State: ${instance.PreviousState?.Name}`);
      return { success: true, instanceId };
    } else {
      return { success: false, message: 'No response from EC2' };
    }
  } catch (error) {
    console.error(`❌ Error stopping EC2 instance: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Upload single file to S3
async function uploadFileToS3(filePath, s3Key) {
  try {
    // Validate configuration
    if (!CONFIG.s3Bucket) {
      const errorMsg = 'S3_BUCKET_NAME not configured in .env file';
      console.error(`❌ Error uploading ${filePath}: ${errorMsg}`);
      return { success: false, file: filePath, error: errorMsg };
    }

    if (!fs.existsSync(filePath)) {
      const errorMsg = `File does not exist: ${filePath}`;
      console.error(`❌ Error uploading ${filePath}: ${errorMsg}`);
      return { success: false, file: filePath, error: errorMsg };
    }

    const fileContent = fs.readFileSync(filePath);
    
    console.log(`   📦 Uploading to S3: Bucket=${CONFIG.s3Bucket}, Key=${s3Key}, Size=${(fileContent.length / 1024).toFixed(2)} KB`);
    
    const command = new PutObjectCommand({
      Bucket: CONFIG.s3Bucket,
      Key: s3Key,
      Body: fileContent,
      ContentType: 'text/html',
      CacheControl: 'public, max-age=31536000',
    });

    // WAIT for upload to complete before continuing
    const response = await s3Client.send(command);
    console.log(`   ✅ Upload successful: ${s3Key}`);
    console.log(`   📋 ETag: ${response.ETag || 'N/A'}`);
    return { success: true, file: filePath, s3Key, etag: response.ETag };
  } catch (error) {
    console.error(`❌ Error uploading ${filePath}:`, error.message);
    console.error(`   Error code: ${error.Code || error.code || 'UNKNOWN'}`);
    console.error(`   Error name: ${error.name || 'UNKNOWN'}`);
    if (error.$metadata) {
      console.error(`   Request ID: ${error.$metadata.requestId}`);
    }
    return { success: false, file: filePath, error: error.message };
  }
}

// Upload files to S3 in batches
async function uploadFilesToS3(files, maxConcurrent = 10) {
  console.log();
  console.log('='.repeat(80));
  console.log('📤 UPLOADING TO S3');
  console.log('='.repeat(80));
  console.log();
  console.log(`📁 Files to upload: ${files.length}`);
  console.log(`📦 Bucket: ${CONFIG.s3Bucket}`);
  console.log(`📂 Prefix: ${CONFIG.s3Prefix || '(none)'}`);
  console.log();

  const results = [];
  
  for (let i = 0; i < files.length; i += maxConcurrent) {
    const batch = files.slice(i, i + maxConcurrent);
    const batchPromises = batch.map(async (file) => {
      const fileName = path.basename(file);
      const s3Key = CONFIG.s3Prefix ? `${CONFIG.s3Prefix}${fileName}` : fileName;
      return await uploadFileToS3(file, s3Key);
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    const uploaded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    process.stdout.write(`\r📤 Progress: ${uploaded} uploaded, ${failed} failed (${Math.min(i + maxConcurrent, files.length)}/${files.length})`);
  }
  
  console.log();
  console.log();

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log('='.repeat(80));
  console.log('📊 UPLOAD SUMMARY');
  console.log('='.repeat(80));
  console.log();
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log();

  if (failed.length > 0) {
    console.log('❌ Failed files:');
    failed.forEach(result => {
      console.log(`   - ${path.basename(result.file)}: ${result.error}`);
    });
    console.log();
  }

  return { successful, failed };
}

// Process batch from CSV/XLSX file
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
  let uploadedCount = 0;
  let uploadFailedCount = 0;
  const failedKeywords = [];
  const uploadFailedKeywords = [];
  
  // Promisified execSync wrapper for parallel processing with immediate upload
  const processKeyword = async (keyword, index) => {
    const progress = `[${index + 1}/${keywords.length}]`;
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`${progress} Processing: "${keyword}"`);
    console.log('='.repeat(80));
    
    try {
      // Call the generate-dynamic-html.js script with the keyword
      // Capture stdout and stderr to get output filename
      const { spawnSync } = require('child_process');
      const result = spawnSync('node', [generateDynamicScriptPath, keyword], {
        encoding: 'utf8',
        cwd: path.join(__dirname, '..')
      });
      
      // Combine stdout and stderr (console.log goes to stdout, but errors to stderr)
      const output = (result.stdout || '') + (result.stderr || '');
      
      // Parse output to extract filename
      // Try multiple patterns in case emoji encoding is different
      let match = output.match(/✅ HTML generated successfully: (.+)/);
      if (!match) {
        match = output.match(/HTML generated successfully: (.+)/);
      }
      if (!match) {
        match = output.match(/generated successfully: (.+)/);
      }
      
      if (match && match[1]) {
        const filePath = match[1].trim();
        
        // Upload immediately after generation
        console.log(`📤 ${progress} Uploading to S3: ${path.basename(filePath)}`);
        const fileName = path.basename(filePath);
        const s3Key = CONFIG.s3Prefix ? `${CONFIG.s3Prefix}${fileName}` : fileName;
        const uploadResult = await uploadFileToS3(filePath, s3Key);
        
        if (uploadResult.success) {
          console.log(`✅ ${progress} Successfully processed and uploaded: "${keyword}"`);
          return { success: true, keyword, index, uploaded: true, filePath };
        } else {
          console.error(`⚠️  ${progress} Generated but upload failed: "${keyword}"`);
          console.error(`   Upload error: ${uploadResult.error}`);
          return { success: true, keyword, index, uploaded: false, filePath, uploadError: uploadResult.error };
        }
      } else {
        // If filename not found in output, try to find newest file
        console.log(`⚠️  ${progress} Could not parse output filename, trying to find newest file...`);
        if (fs.existsSync(CONFIG.outputDir)) {
          const files = fs.readdirSync(CONFIG.outputDir)
            .filter(f => f.endsWith('.html'))
            .map(f => ({
              name: f,
              path: path.join(CONFIG.outputDir, f),
              mtime: fs.statSync(path.join(CONFIG.outputDir, f)).mtime
            }))
            .sort((a, b) => b.mtime - a.mtime);
          
          if (files.length > 0) {
            const newestFile = files[0];
            const s3Key = CONFIG.s3Prefix ? `${CONFIG.s3Prefix}${newestFile.name}` : newestFile.name;
            const uploadResult = await uploadFileToS3(newestFile.path, s3Key);
            
            if (uploadResult.success) {
              console.log(`✅ ${progress} Successfully processed and uploaded (newest file): "${keyword}"`);
              return { success: true, keyword, index, uploaded: true, filePath: newestFile.path };
            }
          }
        }
        
        console.log(`✅ ${progress} Successfully processed: "${keyword}" (upload skipped)`);
        return { success: true, keyword, index, uploaded: false };
      }
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
            if (result.uploaded) {
              uploadedCount++;
            } else if (result.uploadError) {
              uploadFailedCount++;
              uploadFailedKeywords.push(result.keyword);
            }
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
    // Sequential processing
    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];
      const result = await processKeyword(keyword, i);
      
      if (result.success) {
        successCount++;
        if (result.uploaded) {
          uploadedCount++;
        } else if (result.uploadError) {
          uploadFailedCount++;
          uploadFailedKeywords.push(result.keyword);
        }
      } else {
        failCount++;
        failedKeywords.push(result.keyword);
      }
    }
  }
  
  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 GENERATION & UPLOAD SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Generated: ${successCount}/${keywords.length}`);
  console.log(`📤 Uploaded: ${uploadedCount}/${successCount}`);
  console.log(`❌ Generation Failed: ${failCount}/${keywords.length}`);
  console.log(`⚠️  Upload Failed: ${uploadFailedCount}/${successCount}`);
  
  if (failedKeywords.length > 0) {
    console.log(`\n❌ Generation failed keywords:`);
    failedKeywords.forEach(kw => console.log(`   - ${kw}`));
  }
  
  if (uploadFailedKeywords.length > 0) {
    console.log(`\n⚠️  Upload failed keywords:`);
    uploadFailedKeywords.forEach(kw => console.log(`   - ${kw}`));
  }
  
  console.log(`\n✅ Batch processing completed!`);
  
  return { processed: successCount, failed: failCount, uploaded: uploadedCount, uploadFailed: uploadFailedCount, keywords: keywords.length };
}

// Main function
async function main() {
  const keywordsFile = process.argv[2];
  
  if (!keywordsFile) {
    console.error('Usage: node generate-batch-upload-stop.js <keywords-file.csv>');
    console.error('Example: node generate-batch-upload-stop.js config/keywords-variations.csv');
    process.exit(1);
  }

  console.log('='.repeat(80));
  console.log('🚀 GENERATE BATCH + UPLOAD + STOP EC2');
  console.log('='.repeat(80));
  console.log();
  console.log('Configuration:');
  console.log(`   Keywords File: ${keywordsFile}`);
  console.log(`   Output Dir: ${CONFIG.outputDir}`);
  console.log(`   S3 Bucket: ${CONFIG.s3Bucket}`);
  console.log(`   S3 Prefix: ${CONFIG.s3Prefix || '(none)'}`);
  console.log(`   Stop EC2: ${CONFIG.stopEC2 ? 'Yes' : 'No'}`);
  console.log();

  // Validate configuration
  if (!CONFIG.s3Bucket) {
    console.error('❌ S3_BUCKET_NAME not found in .env file');
    process.exit(1);
  }

  try {
    // Step 1: Generate HTML files
    console.log('='.repeat(80));
    console.log('📝 STEP 1: GENERATE HTML FILES');
    console.log('='.repeat(80));
    console.log();
    
    const genResult = await processBatchFromFile(keywordsFile);
    
    // Files are already uploaded during generation (real-time upload)
    // Step 2: Stop EC2 (if enabled)
    if (CONFIG.stopEC2) {
      console.log('='.repeat(80));
      console.log('🛑 STEP 2: STOP EC2 INSTANCE');
      console.log('='.repeat(80));
      console.log();
      
      const instanceId = await getEC2InstanceId();
      if (instanceId) {
        await stopEC2Instance(instanceId);
      } else {
        console.log('⚠️  Could not determine EC2 instance ID.');
        console.log('   Set EC2_INSTANCE_ID in .env file to stop EC2 instance.');
      }
      console.log();
    }

    // Final summary
    console.log('='.repeat(80));
    console.log('✨ PROCESS COMPLETE');
    console.log('='.repeat(80));
    console.log();
    console.log('Summary:');
    console.log(`   Generated: ${genResult.processed} files`);
    console.log(`   Uploaded: ${genResult.uploaded} files (real-time)`);
    console.log(`   Upload Failed: ${genResult.uploadFailed || 0} files`);
    console.log(`   EC2 Stopped: ${CONFIG.stopEC2 ? 'Yes' : 'No'}`);
    console.log();

  } catch (error) {
    console.error('='.repeat(80));
    console.error('❌ FATAL ERROR');
    console.error('='.repeat(80));
    console.error();
    console.error(error.message);
    console.error();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { processBatchFromFile, uploadFilesToS3, stopEC2Instance };

