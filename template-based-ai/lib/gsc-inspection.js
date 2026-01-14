/**
 * Google Search Console URL Inspection API
 * 
 * This module provides functions to inspect URL status using GSC API.
 * API Documentation: https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect
 * 
 * IMPORTANT NOTES:
 * - This API is for INSPECTING status (not requesting indexing)
 * - Limit: 2,000 requests per day per property, 600 per minute
 * - Requires Google Service Account with GSC access
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let searchconsoleClient = null;
let isInitialized = false;

/**
 * Initialize Google Search Console API client
 * @param {string} serviceAccountKeyPath - Path to service account JSON key file
 * @returns {Promise<object>} Initialized Search Console client
 */
async function initializeGSCClient(serviceAccountKeyPath) {
  if (isInitialized && searchconsoleClient) {
    return searchconsoleClient;
  }

  // Check if service account key file exists
  if (!serviceAccountKeyPath) {
    throw new Error('Service account key path is required. Set GOOGLE_SERVICE_ACCOUNT_KEY in .env');
  }

  const keyPath = path.isAbsolute(serviceAccountKeyPath)
    ? serviceAccountKeyPath
    : path.resolve(__dirname, '..', serviceAccountKeyPath);

  if (!fs.existsSync(keyPath)) {
    throw new Error(`Service account key file not found: ${keyPath}`);
  }

  try {
    // Setup authentication
    const auth = new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes: ['https://www.googleapis.com/auth/webmasters']
    });

    // Create Search Console client
    searchconsoleClient = google.searchconsole({
      version: 'v1',
      auth
    });

    isInitialized = true;
    console.log('✅ GSC API client initialized');
    return searchconsoleClient;
  } catch (error) {
    console.error('❌ Failed to initialize GSC client:', error.message);
    throw error;
  }
}

/**
 * Inspect a URL using Google Search Console API
 * 
 * @param {string} inspectionUrl - The URL to inspect (full URL with protocol)
 * @param {string} siteUrl - The site URL property in GSC (must match property)
 * @param {string} serviceAccountKeyPath - Path to service account JSON key file
 * @param {string} languageCode - Optional language code (default: 'en-US')
 * @returns {Promise<object>} Inspection result object
 * 
 * @example
 * const result = await inspectURL(
 *   'https://yoursite.com/page.html',
 *   'https://yoursite.com/',
 *   './service-account-key.json'
 * );
 * console.log(result.inspectionResult.indexStatusResult?.verdict);
 */
export async function inspectURL(
  inspectionUrl,
  siteUrl,
  serviceAccountKeyPath,
  languageCode = 'en-US'
) {
  try {
    // Validate inputs
    if (!inspectionUrl || !siteUrl) {
      throw new Error('inspectionUrl and siteUrl are required');
    }

    // Ensure URLs are properly formatted
    if (!inspectionUrl.startsWith('http://') && !inspectionUrl.startsWith('https://')) {
      throw new Error('inspectionUrl must be a full URL with protocol (http:// or https://)');
    }

    if (!siteUrl.startsWith('http://') && !siteUrl.startsWith('https://')) {
      throw new Error('siteUrl must be a full URL with protocol (http:// or https://)');
    }

    // Ensure siteUrl ends with /
    const normalizedSiteUrl = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;

    // Initialize client if not already initialized
    const client = await initializeGSCClient(serviceAccountKeyPath);

    // Make API request
    const response = await client.urlInspection.index.inspect({
      requestBody: {
        inspectionUrl,
        siteUrl: normalizedSiteUrl,
        languageCode
      }
    });

    return response.data;
  } catch (error) {
    // Handle API errors
    if (error.code === 429) {
      throw new Error('Rate limit exceeded. GSC API limit: 600 requests/minute, 2,000 requests/day');
    } else if (error.code === 403) {
      throw new Error('Permission denied. Check Service Account has access to GSC property');
    } else if (error.code === 404) {
      throw new Error('URL or property not found in Google Search Console');
    } else if (error.message) {
      throw new Error(`GSC API Error: ${error.message}`);
    } else {
      throw error;
    }
  }
}

/**
 * Batch inspect multiple URLs (with rate limiting)
 * 
 * @param {Array<string>} urls - Array of URLs to inspect
 * @param {string} siteUrl - The site URL property in GSC
 * @param {string} serviceAccountKeyPath - Path to service account JSON key file
 * @param {Object} options - Optional configuration
 * @param {number} options.delayMs - Delay between requests in milliseconds (default: 100)
 * @param {number} options.maxConcurrent - Max concurrent requests (default: 1)
 * @returns {Promise<Array<{url: string, result: object|null, error: string|null}>>}
 */
export async function batchInspectURLs(
  urls,
  siteUrl,
  serviceAccountKeyPath,
  options = {}
) {
  const { delayMs = 100, maxConcurrent = 1 } = options;
  const results = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const result = await inspectURL(url, siteUrl, serviceAccountKeyPath);
      results.push({
        url,
        result,
        error: null
      });
      
      // Add delay between requests (except for last one)
      if (i < urls.length - 1 && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      results.push({
        url,
        result: null,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Get indexing status verdict from inspection result
 * 
 * @param {object} inspectionResult - Result from inspectURL()
 * @returns {string|null} Verdict status (e.g., 'PASS', 'PARTIAL', 'FAIL')
 */
export function getIndexingVerdict(inspectionResult) {
  if (!inspectionResult || !inspectionResult.inspectionResult) {
    return null;
  }

  const indexStatus = inspectionResult.inspectionResult.indexStatusResult;
  if (!indexStatus) {
    return null;
  }

  return indexStatus.verdict || null;
}

/**
 * Get mobile usability verdict from inspection result
 * 
 * @param {object} inspectionResult - Result from inspectURL()
 * @returns {string|null} Verdict status
 */
export function getMobileUsabilityVerdict(inspectionResult) {
  if (!inspectionResult || !inspectionResult.inspectionResult) {
    return null;
  }

  const mobileResult = inspectionResult.inspectionResult.mobileUsabilityResult;
  if (!mobileResult) {
    return null;
  }

  return mobileResult.verdict || null;
}

/**
 * Check if URL is indexed according to inspection result
 * 
 * @param {object} inspectionResult - Result from inspectURL()
 * @returns {boolean} True if URL is indexed
 */
export function isURLIndexed(inspectionResult) {
  const verdict = getIndexingVerdict(inspectionResult);
  return verdict === 'PASS' || verdict === 'PARTIAL';
}
