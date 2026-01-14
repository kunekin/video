#!/usr/bin/env node
/**
 * Verify S3 and Sitemap Setup
 * Checks if all required environment variables and dependencies are configured
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

console.log('🔍 Verifying S3 and Sitemap Setup');
console.log('=====================================');
console.log('');

let hasErrors = false;
let hasWarnings = false;

// Check required environment variables
console.log('📋 Required Environment Variables:');
const requiredVars = [
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'S3_BUCKET_NAME'
];

requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (!value) {
    console.log(`   ❌ ${varName}: NOT SET`);
    hasErrors = true;
  } else {
    // Mask sensitive values
    const displayValue = varName.includes('SECRET') || varName.includes('KEY') 
      ? '***' + value.slice(-4) 
      : value;
    console.log(`   ✅ ${varName}: ${displayValue}`);
  }
});

// Check SITEMAP_BASE_URL (optional if S3_BUCKET_URL exists)
console.log('');
console.log('📋 Sitemap Configuration:');
const sitemapBaseUrl = process.env.SITEMAP_BASE_URL;
const s3BucketUrl = process.env.S3_BUCKET_URL;
if (sitemapBaseUrl) {
  console.log(`   ✅ SITEMAP_BASE_URL: ${sitemapBaseUrl}`);
} else if (s3BucketUrl) {
  console.log(`   ⚠️  SITEMAP_BASE_URL: Not set (will use S3_BUCKET_URL: ${s3BucketUrl})`);
} else {
  console.log(`   ⚠️  SITEMAP_BASE_URL: Not set (will use default)`);
}

// Check optional variables
console.log('');
console.log('📋 Optional Environment Variables:');
const optionalVars = [
  'S3_BUCKET_URL',
  'S3_PATH_PREFIX'
];

optionalVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`   ✅ ${varName}: ${value}`);
  } else {
    console.log(`   ⚠️  ${varName}: Not set (will use defaults)`);
  }
});

// Check Bunny CDN configuration
console.log('');
console.log('📋 Bunny CDN Configuration:');
const bunnyStorageZone = process.env.BUNNY_STORAGE_ZONE_NAME;
const bunnyAccessKey = process.env.BUNNY_ACCESS_KEY;
const bunnyRegion = process.env.BUNNY_REGION;
const bunnyPullZone = process.env.BUNNY_PULL_ZONE_URL;

if (bunnyStorageZone && bunnyAccessKey) {
  console.log(`   ✅ BUNNY_STORAGE_ZONE_NAME: ${bunnyStorageZone}`);
  const displayKey = '***' + bunnyAccessKey.slice(-4);
  console.log(`   ✅ BUNNY_ACCESS_KEY: ${displayKey}`);
  if (bunnyRegion) {
    console.log(`   ✅ BUNNY_REGION: ${bunnyRegion}`);
  } else {
    console.log(`   ⚠️  BUNNY_REGION: Not set (will use default: ny)`);
  }
  if (bunnyPullZone) {
    console.log(`   ✅ BUNNY_PULL_ZONE_URL: ${bunnyPullZone}`);
  } else {
    console.log(`   ⚠️  BUNNY_PULL_ZONE_URL: Not set (will use storage zone URL)`);
  }
} else {
  console.log(`   ℹ️  Bunny CDN: Not configured (optional)`);
  if (!bunnyStorageZone) {
    console.log(`      BUNNY_STORAGE_ZONE_NAME: Not set`);
  }
  if (!bunnyAccessKey) {
    console.log(`      BUNNY_ACCESS_KEY: Not set`);
  }
}

// Check Google Indexing API configuration
console.log('');
console.log('📋 Google Indexing API Configuration:');
const indexingEnabled = process.env.GOOGLE_INDEXING_ENABLED === 'true';
const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

if (indexingEnabled) {
  console.log(`   ✅ GOOGLE_INDEXING_ENABLED: true`);
  if (serviceAccountKey) {
    const keyPath = path.isAbsolute(serviceAccountKey)
      ? serviceAccountKey
      : path.resolve(__dirname, '..', serviceAccountKey);
    if (fs.existsSync(keyPath)) {
      console.log(`   ✅ GOOGLE_SERVICE_ACCOUNT_KEY: ${serviceAccountKey} (file exists)`);
    } else {
      console.log(`   ⚠️  GOOGLE_SERVICE_ACCOUNT_KEY: ${serviceAccountKey} (file not found)`);
    }
  } else {
    console.log(`   ⚠️  GOOGLE_SERVICE_ACCOUNT_KEY: Not set (Indexing API will be skipped)`);
  }
} else {
  console.log(`   ℹ️  GOOGLE_INDEXING_ENABLED: false or not set (Indexing API disabled)`);
}

// Check if utility files exist
console.log('');
console.log('📁 Utility Files:');
const utilityFiles = [
  '../lib/s3-utils.js',
  '../lib/bunny-utils.js',
  '../lib/sitemap-utils.js',
  '../lib/indexing-api.js'
];

utilityFiles.forEach(relativePath => {
  const filePath = path.join(__dirname, relativePath);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${path.basename(filePath)}: EXISTS`);
  } else {
    console.log(`   ❌ ${path.basename(filePath)}: NOT FOUND`);
    hasErrors = true;
  }
});

// Check if package.json has AWS SDK
console.log('');
console.log('📦 Dependencies:');
const packageJsonPath = path.join(__dirname, '../package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  if (deps['@aws-sdk/client-s3']) {
    console.log(`   ✅ @aws-sdk/client-s3: ${deps['@aws-sdk/client-s3']}`);
  } else {
    console.log(`   ❌ @aws-sdk/client-s3: NOT INSTALLED`);
    hasErrors = true;
  }
} else {
  console.log(`   ❌ package.json: NOT FOUND`);
  hasErrors = true;
}

// Check output directory
console.log('');
console.log('📂 Directories:');
const outputDir = path.join(__dirname, '../output');
if (fs.existsSync(outputDir)) {
  console.log(`   ✅ output/: EXISTS`);
} else {
  console.log(`   ⚠️  output/: NOT FOUND (will be created automatically)`);
  hasWarnings = true;
}

// Summary
console.log('');
console.log('═══════════════════════════════════════════════════');
if (hasErrors) {
  console.log('❌ Verification FAILED');
  console.log('');
  console.log('Please fix the errors above before running batch generation.');
  console.log('See S3_SETUP.md for configuration instructions.');
  process.exit(1);
} else if (hasWarnings) {
  console.log('⚠️  Verification PASSED with warnings');
  console.log('');
  console.log('Setup looks good! You can proceed with batch generation.');
  console.log('Warnings are non-critical and will be handled automatically.');
  process.exit(0);
} else {
  console.log('✅ Verification PASSED');
  console.log('');
  console.log('All checks passed! You\'re ready to use S3 upload and sitemap features.');
  console.log('');
  console.log('Test with:');
  console.log('  npm run generate-batch -- "your test keyword"');
  process.exit(0);
}
