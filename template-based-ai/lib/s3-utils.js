#!/usr/bin/env node
/**
 * S3 Upload Utility
 * Handles uploading files to AWS S3
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined, // Will use default AWS credentials chain if not provided
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const S3_PATH_PREFIX = process.env.S3_PATH_PREFIX || '';

/**
 * Upload a file to S3
 * @param {string} filePath - Local file path to upload
 * @param {string} s3Key - S3 key (path) where file will be stored
 * @param {string} contentType - Content type (default: text/html)
 * @returns {Promise<string>} - Public URL of uploaded file
 */
export async function uploadToS3(filePath, s3Key, contentType = 'text/html') {
  if (!BUCKET_NAME) {
    throw new Error('S3_BUCKET_NAME is not configured in .env file');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Construct full S3 key with prefix
  const fullS3Key = S3_PATH_PREFIX ? `${S3_PATH_PREFIX}${s3Key}` : s3Key;

  // Read file content
  const fileContent = fs.readFileSync(filePath);

  // Prepare upload command
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fullS3Key,
    Body: fileContent,
    ContentType: contentType,
    CacheControl: 'public, max-age=86400', // Cache for 24 hours
  });

  try {
    // Upload to S3
    await s3Client.send(command);

    // Construct public URL
    const baseUrl = process.env.S3_BUCKET_URL || `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`;
    const publicUrl = `${baseUrl}/${fullS3Key}`;

    return publicUrl;
  } catch (error) {
    throw new Error(`Failed to upload to S3: ${error.message}`);
  }
}

/**
 * Upload HTML file to S3 using filename as key
 * @param {string} filePath - Local file path to upload
 * @returns {Promise<string>} - Public URL of uploaded file
 */
export async function uploadHTMLToS3(filePath) {
  const filename = path.basename(filePath);
  return uploadToS3(filePath, filename, 'text/html');
}

/**
 * Upload sitemap.xml to S3
 * Always uploads to root, ignoring S3_PATH_PREFIX
 * @param {string} filePath - Local sitemap.xml file path
 * @returns {Promise<string>} - Public URL of uploaded sitemap
 */
export async function uploadSitemapToS3(filePath) {
  if (!BUCKET_NAME) {
    throw new Error('S3_BUCKET_NAME is not configured in .env file');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Sitemap always goes to root, ignore PATH_PREFIX
  const s3Key = 'sitemap.xml';

  // Read file content
  const fileContent = fs.readFileSync(filePath);

  // Prepare upload command
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: fileContent,
    ContentType: 'application/xml',
    CacheControl: 'public, max-age=86400', // Cache for 24 hours
  });

  try {
    // Upload to S3
    await s3Client.send(command);

    // Construct public URL (always at root)
    const baseUrl = process.env.S3_BUCKET_URL || `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`;
    const publicUrl = `${baseUrl}/${s3Key}`;

    return publicUrl;
  } catch (error) {
    throw new Error(`Failed to upload sitemap to S3: ${error.message}`);
  }
}
