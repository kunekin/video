const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Validate: Only allow upload from EC2 or explicitly allowed environments
// This prevents accidental uploads from local development
const ALLOW_LOCAL_UPLOAD = process.env.ALLOW_LOCAL_S3_UPLOAD === 'true';
const isEC2 = process.env.USER === 'ec2-user' || 
              process.env.HOSTNAME?.includes('ip-') ||
              fs.existsSync('/sys/hypervisor/uuid');

if (!ALLOW_LOCAL_UPLOAD && !isEC2) {
  console.error('='.repeat(80));
  console.error('⚠️  UPLOAD NOT ALLOWED FROM LOCAL');
  console.error('='.repeat(80));
  console.error();
  console.error('This script is designed to upload files from EC2 only.');
  console.error();
  console.error('To upload from EC2:');
  console.error('   ssh -i nextjs-scraper.pem ec2-user@34.234.84.239');
  console.error('   cd ~/content-local-ai/nextjs-scraper');
  console.error('   npm run upload-s3');
  console.error();
  console.error('If you really want to upload from local (not recommended),');
  console.error('set ALLOW_LOCAL_S3_UPLOAD=true in .env file.');
  console.error();
  process.exit(1);
}

// Configuration
const CONFIG = {
  bucketName: process.env.S3_BUCKET_NAME || '',
  region: process.env.AWS_REGION || 'us-east-1',
  outputDir: process.env.OUTPUT_DIR || path.join(__dirname, '../../output'),
  s3Prefix: process.env.S3_PREFIX || '', // Optional: prefix for S3 keys (e.g., 'html-files/')
  contentType: 'text/html',
  maxConcurrent: parseInt(process.env.S3_MAX_CONCURRENT || '10', 10),
};

// Validate AWS credentials
function validateConfig() {
  if (!process.env.AWS_ACCESS_KEY_ID) {
    console.error('❌ AWS_ACCESS_KEY_ID not found in .env file');
    process.exit(1);
  }
  if (!process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('❌ AWS_SECRET_ACCESS_KEY not found in .env file');
    process.exit(1);
  }
  if (!CONFIG.bucketName) {
    console.error('❌ S3_BUCKET_NAME not found in .env file');
    process.exit(1);
  }
}

// Initialize S3 client
const s3Client = new S3Client({
  region: CONFIG.region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Upload single file to S3
async function uploadFileToS3(filePath, s3Key) {
  try {
    const fileContent = fs.readFileSync(filePath);
    
    const command = new PutObjectCommand({
      Bucket: CONFIG.bucketName,
      Key: s3Key,
      Body: fileContent,
      ContentType: CONFIG.contentType,
      // Optional: Set cache control
      CacheControl: 'public, max-age=31536000', // 1 year
    });

    await s3Client.send(command);
    return { success: true, file: filePath, s3Key };
  } catch (error) {
    console.error(`❌ Error uploading ${filePath}:`, error.message);
    return { success: false, file: filePath, error: error.message };
  }
}

// Process files in batches with concurrency control
async function processBatch(files, batchSize) {
  const results = [];
  
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const batchPromises = batch.map(async (file) => {
      const fileName = path.basename(file);
      const s3Key = CONFIG.s3Prefix ? `${CONFIG.s3Prefix}${fileName}` : fileName;
      return await uploadFileToS3(file, s3Key);
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Progress update
    const uploaded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    console.log(`📤 Progress: ${uploaded} uploaded, ${failed} failed (${i + batch.length}/${files.length})`);
  }
  
  return results;
}

// Main function
async function main() {
  console.log('='.repeat(80));
  console.log('🚀 S3 UPLOAD SCRIPT');
  console.log('='.repeat(80));
  console.log();
  
  // Validate configuration
  validateConfig();
  
  console.log('📋 Configuration:');
  console.log(`   Bucket: ${CONFIG.bucketName}`);
  console.log(`   Region: ${CONFIG.region}`);
  console.log(`   Output Dir: ${CONFIG.outputDir}`);
  console.log(`   S3 Prefix: ${CONFIG.s3Prefix || '(none)'}`);
  console.log(`   Max Concurrent: ${CONFIG.maxConcurrent}`);
  console.log();
  
  // Check if output directory exists
  if (!fs.existsSync(CONFIG.outputDir)) {
    console.error(`❌ Output directory not found: ${CONFIG.outputDir}`);
    process.exit(1);
  }
  
  // Get all HTML files
  const files = fs.readdirSync(CONFIG.outputDir)
    .filter(file => file.endsWith('.html'))
    .map(file => path.join(CONFIG.outputDir, file));
  
  if (files.length === 0) {
    console.log('⚠️  No HTML files found in output directory');
    process.exit(0);
  }
  
  console.log(`📁 Found ${files.length} HTML files`);
  console.log();
  
  // Optional: Check existing files in S3
  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: CONFIG.bucketName,
      Prefix: CONFIG.s3Prefix,
      MaxKeys: 10,
    });
    const listResponse = await s3Client.send(listCommand);
    const existingCount = listResponse.KeyCount || 0;
    console.log(`📊 Existing files in S3: ${existingCount} (showing first 10)`);
    if (listResponse.Contents && listResponse.Contents.length > 0) {
      console.log('   Sample keys:');
      listResponse.Contents.slice(0, 5).forEach(obj => {
        console.log(`   - ${obj.Key}`);
      });
    }
    console.log();
  } catch (error) {
    console.log(`⚠️  Could not list existing files: ${error.message}`);
    console.log();
  }
  
  // Upload files
  console.log('📤 Starting upload...');
  console.log();
  
  const startTime = Date.now();
  const results = await processBatch(files, CONFIG.maxConcurrent);
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  // Summary
  console.log();
  console.log('='.repeat(80));
  console.log('📊 UPLOAD SUMMARY');
  console.log('='.repeat(80));
  console.log();
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`📈 Average: ${(successful.length / duration).toFixed(2)} files/sec`);
  console.log();
  
  if (failed.length > 0) {
    console.log('❌ Failed files:');
    failed.forEach(result => {
      console.log(`   - ${path.basename(result.file)}: ${result.error}`);
    });
    console.log();
  }
  
  // Show S3 URLs
  if (successful.length > 0) {
    console.log('🌐 Sample S3 URLs:');
    successful.slice(0, 5).forEach(result => {
      const url = `https://${CONFIG.bucketName}.s3.${CONFIG.region}.amazonaws.com/${result.s3Key}`;
      console.log(`   ${url}`);
    });
    if (successful.length > 5) {
      console.log(`   ... and ${successful.length - 5} more`);
    }
    console.log();
  }
  
  console.log('='.repeat(80));
  console.log('✨ Upload complete!');
  console.log('='.repeat(80));
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { uploadFileToS3, processBatch };

