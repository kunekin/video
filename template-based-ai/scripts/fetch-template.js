#!/usr/bin/env node
/**
 * Fetch HTML template from packaginginsights.com
 * This only needs to run ONCE (or periodically for refresh)
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const TEMPLATE_URL = process.env.TEMPLATE_URL || 'https://www.packaginginsights.com/video/drinktec-2025-sidel-debuts-laser-blowing.html';
const TEMPLATE_FILE = path.join(__dirname, '../templates/base-template.html');

async function fetchTemplate() {
  console.log('🌐 Fetching template from:', TEMPLATE_URL);
  console.log('');

  try {
    const response = await axios.get(TEMPLATE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 30000,
    });

    if (response.status === 200) {
      const html = response.data;
      
      // Save template
      fs.writeFileSync(TEMPLATE_FILE, html, 'utf8');
      
      console.log('✅ Template fetched successfully!');
      console.log('');
      console.log('📊 Template Stats:');
      console.log(`   File: ${TEMPLATE_FILE}`);
      console.log(`   Size: ${html.length.toLocaleString()} bytes (${(html.length / 1024).toFixed(1)} KB)`);
      console.log(`   Lines: ${html.split('\n').length.toLocaleString()}`);
      console.log('');
      console.log('✅ Template ready for use!');
      console.log('   Next: npm run generate');
    } else {
      console.error('❌ Failed to fetch template');
      console.error(`   Status: ${response.status}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error fetching template:', error.message);
    process.exit(1);
  }
}

fetchTemplate();
