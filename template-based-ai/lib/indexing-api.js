#!/usr/bin/env node
/**
 * Google Indexing API Utility
 * 
 * This module provides functions to request URL indexing using Google Indexing API.
 * API Documentation: https://developers.google.com/search/apis/indexing-api/v3/using-api
 * 
 * IMPORTANT NOTES:
 * - Limit: 200 requests per day per property
 * - Requires Google Service Account with Indexing API enabled
 * - Service Account must be added as Owner in Google Search Console
 * - Officially recommended for JobPosting or BroadcastEvent, but works for other content types
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

let indexingClient = null;
let isInitialized = false;

/**
 * Initialize Google Indexing API client
 * @param {string} serviceAccountKeyPath - Path to service account JSON key file
 * @returns {Promise<object>} Initialized Indexing API client
 */
async function initializeIndexingClient(serviceAccountKeyPath) {
  if (isInitialized && indexingClient) {
    return indexingClient;
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
    // Setup authentication with Indexing API scope
    const auth = new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes: ['https://www.googleapis.com/auth/indexing']
    });

    // Create Indexing API client
    indexingClient = google.indexing({
      version: 'v3',
      auth
    });

    isInitialized = true;
    return indexingClient;
  } catch (error) {
    console.error('❌ Failed to initialize Indexing API client:', error.message);
    throw error;
  }
}

/**
 * Request indexing for a URL (publish or update)
 * 
 * @param {string} url - The URL to request indexing for (full URL with protocol)
 * @param {string} serviceAccountKeyPath - Path to service account JSON key file
 * @param {string} type - Request type: 'URL_UPDATED' (default) or 'URL_DELETED'
 * @returns {Promise<object>} API response
 * 
 * @example
 * await requestIndexing(
 *   'https://yoursite.com/page.html',
 *   './service-account-key.json',
 *   'URL_UPDATED'
 * );
 */
export async function requestIndexing(url, serviceAccountKeyPath, type = 'URL_UPDATED') {
  try {
    // Validate inputs
    if (!url) {
      throw new Error('URL is required');
    }

    // Ensure URL is properly formatted
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('URL must be a full URL with protocol (http:// or https://)');
    }

    // Validate type
    if (type !== 'URL_UPDATED' && type !== 'URL_DELETED') {
      throw new Error('Type must be either URL_UPDATED or URL_DELETED');
    }

    // Initialize client if not already initialized
    const client = await initializeIndexingClient(serviceAccountKeyPath);

    // Make API request
    const response = await client.urlNotifications.publish({
      requestBody: {
        url: url,
        type: type
      }
    });

    return response.data;
  } catch (error) {
    // Handle API errors
    if (error.code === 429) {
      throw new Error('Rate limit exceeded. Indexing API limit: 200 requests/day per property');
    } else if (error.code === 403) {
      if (error.message && error.message.includes('Failed to verify the URL ownership')) {
        throw new Error('Permission denied. Service Account must be added as Owner in Google Search Console for this property');
      } else if (error.message && error.message.includes('not been used') || error.message && error.message.includes('disabled')) {
        throw new Error('Indexing API not enabled. Enable it in Google Cloud Console for your project');
      }
      throw new Error('Permission denied. Check Service Account has access and Indexing API is enabled');
    } else if (error.code === 404) {
      throw new Error('URL or property not found in Google Search Console');
    } else if (error.message) {
      throw new Error(`Indexing API Error: ${error.message}`);
    } else {
      throw error;
    }
  }
}

/**
 * Request indexing for multiple URLs (with rate limiting)
 * 
 * @param {Array<string>} urls - Array of URLs to request indexing for
 * @param {string} serviceAccountKeyPath - Path to service account JSON key file
 * @param {Object} options - Optional configuration
 * @param {number} options.delayMs - Delay between requests in milliseconds (default: 500)
 * @param {string} options.type - Request type: 'URL_UPDATED' (default) or 'URL_DELETED'
 * @returns {Promise<Array<{url: string, success: boolean, error: string|null}>>}
 */
export async function requestIndexingBatch(urls, serviceAccountKeyPath, options = {}) {
  const { delayMs = 500, type = 'URL_UPDATED' } = options;
  const results = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      await requestIndexing(url, serviceAccountKeyPath, type);
      results.push({ url, success: true, error: null });
      
      // Add delay between requests to avoid rate limiting
      if (i < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      results.push({ url, success: false, error: error.message });
    }
  }

  return results;
}

/**
 * Get URL notification metadata
 * 
 * @param {string} url - The URL to check
 * @param {string} serviceAccountKeyPath - Path to service account JSON key file
 * @returns {Promise<object>} Notification metadata
 */
export async function getUrlNotification(url, serviceAccountKeyPath) {
  try {
    if (!url) {
      throw new Error('URL is required');
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('URL must be a full URL with protocol (http:// or https://)');
    }

    // Initialize client if not already initialized
    const client = await initializeIndexingClient(serviceAccountKeyPath);

    // Make API request
    const response = await client.urlNotifications.getMetadata({
      url: url
    });

    return response.data;
  } catch (error) {
    if (error.code === 404) {
      throw new Error('URL notification not found');
    } else if (error.message) {
      throw new Error(`Indexing API Error: ${error.message}`);
    } else {
      throw error;
    }
  }
}
