#!/usr/bin/env node
/**
 * Test Google Search Console URL Inspection API
 * 
 * Usage:
 *   node scripts/test-gsc-inspection.js <url> <siteUrl>
 * 
 * Example:
 *   node scripts/test-gsc-inspection.js "https://yoursite.com/page.html" "https://yoursite.com/"
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  inspectURL,
  getIndexingVerdict,
  getMobileUsabilityVerdict,
  isURLIndexed
} from '../lib/gsc-inspection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function testGSCInspection() {
  console.log('🧪 Testing Google Search Console URL Inspection API');
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  // Get parameters
  const inspectionUrl = process.argv[2];
  const siteUrl = process.argv[3] || process.env.ORIGINAL_SITE_URL;
  const serviceAccountKeyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  // Validate inputs
  if (!inspectionUrl) {
    console.error('❌ Error: inspectionUrl is required');
    console.error('');
    console.error('Usage:');
    console.error('  node scripts/test-gsc-inspection.js <inspectionUrl> [siteUrl]');
    console.error('');
    console.error('Example:');
    console.error('  node scripts/test-gsc-inspection.js "https://yoursite.com/page.html" "https://yoursite.com/"');
    console.error('');
    console.error('Or set in .env:');
    console.error('  ORIGINAL_SITE_URL=https://yoursite.com/');
    console.error('  GOOGLE_SERVICE_ACCOUNT_KEY=./service-account-key.json');
    process.exit(1);
  }

  if (!siteUrl) {
    console.error('❌ Error: siteUrl is required (provide as argument or set ORIGINAL_SITE_URL in .env)');
    process.exit(1);
  }

  if (!serviceAccountKeyPath) {
    console.error('❌ Error: GOOGLE_SERVICE_ACCOUNT_KEY is not set in .env');
    console.error('');
    console.error('Please add to .env:');
    console.error('  GOOGLE_SERVICE_ACCOUNT_KEY=./service-account-key.json');
    process.exit(1);
  }

  console.log('📋 Configuration:');
  console.log(`   Inspection URL: ${inspectionUrl}`);
  console.log(`   Site URL: ${siteUrl}`);
  console.log(`   Service Account Key: ${serviceAccountKeyPath}`);
  console.log('');

  try {
    console.log('🔍 Inspecting URL...');
    const startTime = Date.now();

    const result = await inspectURL(
      inspectionUrl,
      siteUrl,
      serviceAccountKeyPath
    );

    const elapsedTime = Date.now() - startTime;
    console.log(`✅ Inspection completed (${elapsedTime}ms)`);
    console.log('');

    // Display results
    console.log('📊 Inspection Results:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Index Status
    const indexStatus = result.inspectionResult?.indexStatusResult;
    if (indexStatus) {
      console.log('📄 Index Status:');
      console.log(`   Verdict: ${indexStatus.verdict || 'N/A'}`);
      console.log(`   Coverage State: ${indexStatus.coverageState || 'N/A'}`);
      console.log(`   Indexed: ${isURLIndexed(result) ? '✅ Yes' : '❌ No'}`);
      if (indexStatus.lastCrawlTime) {
        console.log(`   Last Crawl: ${indexStatus.lastCrawlTime}`);
      }
      if (indexStatus.pageFetchState) {
        console.log(`   Page Fetch State: ${indexStatus.pageFetchState}`);
      }
      console.log('');
    }

    // Mobile Usability
    const mobileResult = result.inspectionResult?.mobileUsabilityResult;
    if (mobileResult) {
      console.log('📱 Mobile Usability:');
      console.log(`   Verdict: ${getMobileUsabilityVerdict(result) || 'N/A'}`);
      if (mobileResult.issues && mobileResult.issues.length > 0) {
        console.log(`   Issues: ${mobileResult.issues.length}`);
        mobileResult.issues.forEach((issue, index) => {
          console.log(`     ${index + 1}. ${issue.issueType || 'Unknown'}: ${issue.severity || 'N/A'}`);
        });
      }
      console.log('');
    }

    // AMP Result
    const ampResult = result.inspectionResult?.ampResult;
    if (ampResult) {
      console.log('⚡ AMP Status:');
      console.log(`   Verdict: ${ampResult.verdict || 'N/A'}`);
      if (ampResult.issues && ampResult.issues.length > 0) {
        console.log(`   Issues: ${ampResult.issues.length}`);
      }
      console.log('');
    }

    // Rich Results
    const richResults = result.inspectionResult?.richResultsResult;
    if (richResults) {
      console.log('🎨 Rich Results:');
      console.log(`   Verdict: ${richResults.verdict || 'N/A'}`);
      if (richResults.detectedItems && richResults.detectedItems.length > 0) {
        console.log(`   Detected Items: ${richResults.detectedItems.length}`);
        richResults.detectedItems.forEach((item, index) => {
          console.log(`     ${index + 1}. ${item.richResultType || 'Unknown'}`);
        });
      }
      console.log('');
    }

    // Full result (optional, commented out by default)
    // console.log('📋 Full Result:');
    // console.log(JSON.stringify(result, null, 2));
    // console.log('');

    console.log('✅ Test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:');
    console.error(`   ${error.message}`);
    console.error('');
    
    if (error.message.includes('not found')) {
      console.error('💡 Tips:');
      console.error('   1. Check if service account key file exists');
      console.error('   2. Verify the file path in .env is correct');
    } else if (error.message.includes('Permission denied')) {
      console.error('💡 Tips:');
      console.error('   1. Add Service Account email to GSC as Owner');
      console.error('   2. Verify Service Account has correct permissions');
    } else if (error.message.includes('Rate limit')) {
      console.error('💡 Tips:');
      console.error('   1. Wait before making more requests');
      console.error('   2. GSC API limit: 600/minute, 2,000/day');
    }
    
    process.exit(1);
  }
}

testGSCInspection().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
