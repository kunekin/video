# Google Indexing API Setup

## Overview

Google Indexing API allows you to request immediate indexing of URLs instead of waiting for Google to crawl them naturally. This is integrated into the batch generation process.

## Environment Variables Required

Add these variables to your `.env` file in `template-based-ai/` directory:

```env
# Google Indexing API Configuration (Optional)
GOOGLE_INDEXING_ENABLED=true
GOOGLE_SERVICE_ACCOUNT_KEY=./service-account-key.json
```

**Note:** If `GOOGLE_INDEXING_ENABLED` is not set or set to `false`, Indexing API requests will be skipped.

## Setup Instructions

### 1. Enable Indexing API in Google Cloud Platform

1. Go to [Google Cloud Platform Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** → **Library**
4. Search for "Indexing API"
5. Click **Enable**

### 2. Create Service Account (if not already exists)

If you already have a service account key file (service-account-key.json), you can skip this step.

1. Go to **IAM & Admin** → **Service Accounts**
2. Click **Create Service Account**
3. Enter a name (e.g., "indexing-api-service")
4. Click **Create and Continue**
5. Skip role assignment (click **Continue**)
6. Click **Done**

### 3. Create Service Account Key

1. Click on the service account you just created
2. Go to **Keys** tab
3. Click **Add Key** → **Create new key**
4. Choose **JSON** format
5. Download the key file and save it as `service-account-key.json` in `template-based-ai/` directory

### 4. Add Service Account to Google Search Console

**IMPORTANT:** The service account must be added as **Owner** in Google Search Console.

1. Go to [Google Search Console](https://search.google.com/search-console/)
2. Select your property (e.g., `https://kunekin.s3.amazonaws.com`)
3. Go to **Settings** → **Users and permissions**
4. Click **Add User** (three dots menu)
5. Enter the **Service Account Email** (from service-account-key.json, field: `client_email`)
   - Example: `api-746@dating-indexing.iam.gserviceaccount.com`
6. Set permission to **Owner**
7. Click **Add**

### 5. Verify Service Account Key Path

Ensure the `GOOGLE_SERVICE_ACCOUNT_KEY` in `.env` points to the correct path:
- Relative path: `./service-account-key.json`
- Absolute path: `/full/path/to/service-account-key.json`

## Usage

After setup, the Indexing API will automatically request indexing for each file after it's uploaded to S3, if `GOOGLE_INDEXING_ENABLED=true`.

The process flow:
1. Generate HTML file → Save locally
2. Upload to S3
3. **Request Google Indexing** (if enabled)
4. Track URL for sitemap
5. Update sitemap and upload

## Rate Limits

- **200 requests per day** per property
- If you generate many files, be aware of this limit
- The script adds a 500ms delay between requests to avoid hitting rate limits

## Important Notes

1. **Officially Recommended For:**
   - JobPosting structured data
   - BroadcastEvent structured data
   
   However, it works for other content types as well (use at your own discretion).

2. **Service Account Permission:**
   - Must be added as **Owner** (not just User) in Google Search Console
   - Must have access to the property where URLs are hosted

3. **Domain Verification:**
   - The service account must have access to the property in GSC
   - URLs must belong to a verified property

4. **Error Handling:**
   - If indexing request fails, the script continues with sitemap update
   - Errors are logged but don't stop the batch generation process

## Troubleshooting

### Error: "Permission denied. Service Account must be added as Owner"
- Check that service account email is added as **Owner** (not User) in GSC
- Verify the service account email matches the `client_email` in service-account-key.json

### Error: "Indexing API not enabled"
- Enable Indexing API in Google Cloud Platform
- Go to APIs & Services → Library → Search "Indexing API" → Enable

### Error: "Rate limit exceeded"
- You've reached the 200 requests/day limit
- Wait 24 hours or reduce the number of files generated per day

### Indexing requests not happening
- Check `GOOGLE_INDEXING_ENABLED=true` in `.env`
- Check `GOOGLE_SERVICE_ACCOUNT_KEY` path is correct
- Check service account key file exists and is valid JSON
