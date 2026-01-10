#!/usr/bin/env node
/**
 * Test Google Indexing API
 * 
 * Usage:
 *   node scripts/test-indexing-api.js <url> [type]
 * 
 * Example:
 *   node scripts/test-indexing-api.js "https://kunekin.s3.amazonaws.com/file.html" "URL_UPDATED"
 * 
 * Or with npm:
 *   npm run test-indexing -- "https://kunekin.s3.amazonaws.com/file.html"
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  requestIndexing,
  getUrlNotification
} from '../lib/indexing-api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function testIndexingAPI() {
  console.log('🧪 Testing Google Indexing API');
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  // Get parameters
  const url = process.argv[2];
  const type = process.argv[3] || 'URL_UPDATED';
  const serviceAccountKeyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  // Validate inputs
  if (!url) {
    console.error('❌ Error: URL is required');
    console.error('');
    console.error('Usage:');
    console.error('  node scripts/test-indexing-api.js <url> [type]');
    console.error('');
    console.error('Example:');
    console.error('  node scripts/test-indexing-api.js "https://yoursite.com/page.html" "URL_UPDATED"');
    console.error('');
    console.error('Or with npm:');
    console.error('  npm run test-indexing -- "https://yoursite.com/page.html"');
    console.error('');
    console.error('Type options:');
    console.error('  URL_UPDATED (default) - Request indexing for new/updated URL');
    console.error('  URL_DELETED - Request removal from index');
    console.error('');
    console.error('Environment variables required:');
    console.error('  GOOGLE_SERVICE_ACCOUNT_KEY=./service-account-key.json');
    process.exit(1);
  }

  if (!serviceAccountKeyPath) {
    console.error('❌ Error: GOOGLE_SERVICE_ACCOUNT_KEY is not set in .env');
    console.error('');
    console.error('Please add to .env:');
    console.error('  GOOGLE_SERVICE_ACCOUNT_KEY=./service-account-key.json');
    process.exit(1);
  }

  // Validate type
  if (type !== 'URL_UPDATED' && type !== 'URL_DELETED') {
    console.error('❌ Error: Type must be either URL_UPDATED or URL_DELETED');
    process.exit(1);
  }

  console.log('📋 Configuration:');
  console.log(`   URL: ${url}`);
  console.log(`   Type: ${type}`);
  console.log(`   Service Account Key: ${serviceAccountKeyPath}`);
  console.log('');

  try {
    // Step 1: Submit indexing request
    console.log('📤 Step 1: Submitting indexing request...');
    const submitStartTime = Date.now();

    const submitResponse = await requestIndexing(
      url,
      serviceAccountKeyPath,
      type
    );

    const submitElapsedTime = Date.now() - submitStartTime;
    console.log(`✅ Submit completed (${submitElapsedTime}ms)`);
    console.log('');

    // Display submit response details
    console.log('📊 Submit Response Details:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (submitResponse?.urlNotificationMetadata) {
      const metadata = submitResponse.urlNotificationMetadata;
      console.log(`   URL: ${metadata.url || url}`);
      
      if (metadata.latestUpdate) {
        console.log(`   Latest Update:`);
        console.log(`      Type: ${metadata.latestUpdate.type || 'N/A'}`);
        console.log(`      Notify Time: ${metadata.latestUpdate.notifyTime || 'N/A'}`);
        console.log(`      URL: ${metadata.latestUpdate.url || 'N/A'}`);
      }
      
      if (metadata.latestRemove) {
        console.log(`   Latest Remove:`);
        console.log(`      Type: ${metadata.latestRemove.type || 'N/A'}`);
        console.log(`      Notify Time: ${metadata.latestRemove.notifyTime || 'N/A'}`);
        console.log(`      URL: ${metadata.latestRemove.url || 'N/A'}`);
      }
    } else {
      console.log('   Response structure:', JSON.stringify(submitResponse, null, 2));
    }
    console.log('');

    // Step 2: Check notification status (optional, but recommended)
    console.log('🔍 Step 2: Checking notification metadata...');
    const checkStartTime = Date.now();

    try {
      // Add small delay to ensure metadata is available
      await new Promise(resolve => setTimeout(resolve, 1000));

      const notificationMetadata = await getUrlNotification(
        url,
        serviceAccountKeyPath
      );

      const checkElapsedTime = Date.now() - checkStartTime;
      console.log(`✅ Status check completed (${checkElapsedTime}ms)`);
      console.log('');

      // Display notification metadata details
      console.log('📊 Notification Metadata:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`   URL: ${notificationMetadata.url || url}`);
      
      if (notificationMetadata.latestUpdate) {
        console.log(`   Latest Update:`);
        console.log(`      Type: ${notificationMetadata.latestUpdate.type || 'N/A'}`);
        console.log(`      Notify Time: ${notificationMetadata.latestUpdate.notifyTime || 'N/A'}`);
        console.log(`      URL: ${notificationMetadata.latestUpdate.url || 'N/A'}`);
      } else {
        console.log(`   Latest Update: Not available`);
      }
      
      if (notificationMetadata.latestRemove) {
        console.log(`   Latest Remove:`);
        console.log(`      Type: ${notificationMetadata.latestRemove.type || 'N/A'}`);
        console.log(`      Notify Time: ${notificationMetadata.latestRemove.notifyTime || 'N/A'}`);
        console.log(`      URL: ${notificationMetadata.latestRemove.url || 'N/A'}`);
      } else {
        console.log(`   Latest Remove: Not available`);
      }
      console.log('');
    } catch (checkError) {
      console.log(`⚠️  Status check failed: ${checkError.message}`);
      console.log('   (This is normal if notification metadata is not immediately available)');
      console.log('');
    }

    console.log('✅ Test completed successfully!');
    console.log('');
    console.log('💡 Notes:');
    console.log('   • Indexing API limit: 200 requests/day per property');
    console.log('   • Notification metadata may take a few seconds to become available');
    console.log('   • Check Google Search Console for indexing status');
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
      console.error('   1. Add Service Account email to GSC as Owner (not just User)');
      console.error('   2. Verify Service Account has access to the property');
      console.error('   3. Ensure Indexing API is enabled in Google Cloud Console');
    } else if (error.message.includes('Rate limit')) {
      console.error('💡 Tips:');
      console.error('   1. Wait before making more requests');
      console.error('   2. Indexing API limit: 200 requests/day per property');
    } else if (error.message.includes('not enabled')) {
      console.error('💡 Tips:');
      console.error('   1. Enable Indexing API in Google Cloud Console');
      console.error('   2. Go to APIs & Services → Library → Search "Indexing API" → Enable');
    } else if (error.message.includes('URL ownership')) {
      console.error('💡 Tips:');
      console.error('   1. Service Account must be added as Owner (not User) in GSC');
      console.error('   2. URL must belong to a verified property in GSC');
      console.error('   3. Service Account email must match the one in service account key file');
    }
    
    process.exit(1);
  }
}

testIndexingAPI().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
