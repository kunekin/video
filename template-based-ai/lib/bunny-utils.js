#!/usr/bin/env node
/**
 * Bunny CDN Storage Upload Utility
 * Handles uploading files to Bunny CDN Storage
 * 
 * Documentation: https://docs.bunny.net/reference/storage-api
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const STORAGE_ZONE_NAME = process.env.BUNNY_STORAGE_ZONE_NAME;
const ACCESS_KEY = process.env.BUNNY_ACCESS_KEY;
const API_KEY = process.env.BUNNY_API_KEY; // Pull Zone API Key for cache purging
const REGION = process.env.BUNNY_REGION || 'ny';
const PATH_PREFIX = process.env.BUNNY_PATH_PREFIX || '';
const PULL_ZONE_URL = process.env.BUNNY_PULL_ZONE_URL;

/**
 * Get storage endpoint based on region
 * @param {string} region - Region code (ny, la, sg, etc.)
 * @returns {string} Storage endpoint
 * 
 * Note: Frankfurt (de) uses storage.bunnycdn.com (no region prefix)
 * Other regions use {region}.storage.bunnycdn.com
 */
function getStorageEndpoint(region) {
  // Frankfurt (de) uses storage.bunnycdn.com without region prefix
  if (region === 'de') {
    return 'storage.bunnycdn.com';
  }
  return `${region}.storage.bunnycdn.com`;
}

/**
 * Upload a file to Bunny CDN Storage
 * @param {string} filePath - Local file path to upload
 * @param {string} bunnyKey - Bunny CDN key (path) where file will be stored
 * @param {string} contentType - Content type (default: text/html)
 * @returns {Promise<string>} - Public URL of uploaded file
 */
export async function uploadToBunny(filePath, bunnyKey, contentType = 'text/html') {
  if (!STORAGE_ZONE_NAME) {
    throw new Error('BUNNY_STORAGE_ZONE_NAME is not configured in .env file');
  }

  if (!ACCESS_KEY) {
    throw new Error('BUNNY_ACCESS_KEY is not configured in .env file');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Construct full Bunny key with prefix
  const fullBunnyKey = PATH_PREFIX ? `${PATH_PREFIX}${bunnyKey}` : bunnyKey;
  
  // Ensure key doesn't start with /
  const cleanKey = fullBunnyKey.startsWith('/') ? fullBunnyKey.slice(1) : fullBunnyKey;

  // Read file content
  const fileContent = fs.readFileSync(filePath);

  // Construct upload URL
  const storageEndpoint = getStorageEndpoint(REGION);
  const uploadUrl = `https://${storageEndpoint}/${STORAGE_ZONE_NAME}/${cleanKey}`;

  try {
    // Upload to Bunny CDN Storage
    await axios.put(uploadUrl, fileContent, {
      headers: {
        AccessKey: ACCESS_KEY,
        'Content-Type': contentType,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    // Construct public URL
    // If PULL_ZONE_URL is configured, use it; otherwise construct from storage zone
    if (PULL_ZONE_URL) {
      const cleanPullZoneUrl = PULL_ZONE_URL.replace(/\/$/, '');
      const publicUrl = `${cleanPullZoneUrl}/${cleanKey}`;
      return publicUrl;
    } else {
      // Fallback: construct URL from storage zone name
      const publicUrl = `https://${STORAGE_ZONE_NAME}.b-cdn.net/${cleanKey}`;
      return publicUrl;
    }
  } catch (error) {
    if (error.response) {
      throw new Error(`Failed to upload to Bunny CDN: ${error.response.status} ${error.response.statusText} - ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      throw new Error(`Failed to upload to Bunny CDN: No response received - ${error.message}`);
    } else {
      throw new Error(`Failed to upload to Bunny CDN: ${error.message}`);
    }
  }
}

/**
 * Upload HTML file to Bunny CDN using filename as key
 * @param {string} filePath - Local file path to upload
 * @returns {Promise<string>} - Public URL of uploaded file
 */
export async function uploadHTMLToBunny(filePath) {
  const filename = path.basename(filePath);
  return uploadToBunny(filePath, filename, 'text/html');
}

/**
 * Purge cache for a specific URL in Bunny CDN Pull Zone
 * @param {string} url - Full URL to purge from cache
 * @returns {Promise<void>}
 */
export async function purgeCache(url) {
  if (!API_KEY) {
    throw new Error('BUNNY_API_KEY is not configured in .env file (required for cache purging). Get your API key from: Dashboard → Account → API (Account API Key) or Pull Zones → Select Zone → API (Pull Zone API Key)');
  }

  if (!url) {
    throw new Error('URL is required for cache purging');
  }

  const purgeEndpoint = 'https://bunnycdn.com/api/purge';

  try {
    // API expects object with urls property containing array of URLs
    const response = await axios.post(
      purgeEndpoint,
      { urls: [url] }, // Object with urls array (at least one, max 50)
      {
        headers: {
          AccessKey: API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    if (error.response) {
      // Provide helpful error message for 401 errors
      if (error.response.status === 401) {
        throw new Error(`Failed to purge cache: 401 Unauthorized. Please verify your BUNNY_API_KEY is correct. Use Account API Key (Dashboard → Account → API) or Pull Zone API Key (Pull Zones → Select Zone → API). Note: Storage Access Key (BUNNY_ACCESS_KEY) cannot be used for cache purging.`);
      }
      throw new Error(`Failed to purge cache: ${error.response.status} ${error.response.statusText} - ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      throw new Error(`Failed to purge cache: No response received - ${error.message}`);
    } else {
      throw new Error(`Failed to purge cache: ${error.message}`);
    }
  }
}

/**
 * Purge cache for sitemap.xml
 * @param {string} sitemapUrl - Full URL of sitemap.xml to purge
 * @returns {Promise<void>}
 */
export async function purgeSitemapCache(sitemapUrl) {
  return purgeCache(sitemapUrl);
}

/**
 * Upload sitemap.xml to Bunny CDN
 * Always uploads to root, ignoring BUNNY_PATH_PREFIX
 * Automatically purges cache after successful upload (if BUNNY_API_KEY is configured)
 * @param {string} filePath - Local sitemap.xml file path
 * @returns {Promise<string>} - Public URL of uploaded sitemap
 */
export async function uploadSitemapToBunny(filePath) {
  if (!STORAGE_ZONE_NAME) {
    throw new Error('BUNNY_STORAGE_ZONE_NAME is not configured in .env file');
  }

  if (!ACCESS_KEY) {
    throw new Error('BUNNY_ACCESS_KEY is not configured in .env file');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Sitemap always goes to root, ignore PATH_PREFIX
  const bunnyKey = 'sitemap.xml';

  // Read file content
  const fileContent = fs.readFileSync(filePath);

  // Construct upload URL (always at root)
  const storageEndpoint = getStorageEndpoint(REGION);
  const uploadUrl = `https://${storageEndpoint}/${STORAGE_ZONE_NAME}/${bunnyKey}`;

  try {
    // Upload to Bunny CDN Storage
    await axios.put(uploadUrl, fileContent, {
      headers: {
        AccessKey: ACCESS_KEY,
        'Content-Type': 'application/xml',
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    // Construct public URL (always at root)
    let publicUrl;
    if (PULL_ZONE_URL) {
      const cleanPullZoneUrl = PULL_ZONE_URL.replace(/\/$/, '');
      publicUrl = `${cleanPullZoneUrl}/${bunnyKey}`;
    } else {
      // Fallback: construct URL from storage zone name
      publicUrl = `https://${STORAGE_ZONE_NAME}.b-cdn.net/${bunnyKey}`;
    }

    // Purge cache after successful upload (if API key is configured)
    if (API_KEY) {
      try {
        await purgeSitemapCache(publicUrl);
        console.log(`   🔄 Cache purged: ${publicUrl}`);
      } catch (purgeError) {
        // Log purge error but don't fail the upload
        console.warn(`⚠️  Cache purge failed (upload was successful): ${purgeError.message}`);
      }
    }

    return publicUrl;
  } catch (error) {
    if (error.response) {
      throw new Error(`Failed to upload sitemap to Bunny CDN: ${error.response.status} ${error.response.statusText} - ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      throw new Error(`Failed to upload sitemap to Bunny CDN: No response received - ${error.message}`);
    } else {
      throw new Error(`Failed to upload sitemap to Bunny CDN: ${error.message}`);
    }
  }
}
