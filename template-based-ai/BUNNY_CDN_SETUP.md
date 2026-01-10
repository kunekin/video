# Bunny CDN Storage Setup

## Overview

Bunny CDN Storage provides a cost-effective CDN solution for hosting static files. This integration allows automatic upload of generated HTML files and sitemap to Bunny CDN Storage.

## Environment Variables Required

Add these variables to your `.env` file in `template-based-ai/` directory:

```env
# Bunny CDN Storage Configuration (Optional)
BUNNY_STORAGE_ZONE_NAME=your-storage-zone-name
BUNNY_ACCESS_KEY=your-access-key
BUNNY_REGION=ny
BUNNY_PULL_ZONE_URL=https://your-pull-zone.b-cdn.net

# Optional: Path prefix (if files should be stored in a folder)
# BUNNY_PATH_PREFIX=content/
```

**Note:** Bunny CDN upload is optional. If not configured, only S3 upload will be used (if S3 is configured).

## Setup Instructions

### 1. Create Bunny CDN Storage Zone

1. Go to [Bunny CDN Dashboard](https://bunny.net/)
2. Sign in to your account
3. Navigate to **Storage** → **Add Storage Zone**
4. Enter a name for your storage zone
5. Select a region (e.g., New York, Los Angeles, Singapore)
6. Click **Add Storage Zone**

### 2. Get Access Key

1. Click on your Storage Zone
2. Go to **FTP & API Access** tab
3. Copy the **Password** (this is your Access Key)
4. Save it securely (you'll need it for `BUNNY_ACCESS_KEY`)

### 3. Create Pull Zone (Optional but Recommended)

Pull Zones provide CDN distribution for your storage zone:

1. Go to **Pull Zones** → **Add Pull Zone**
2. Enter a name for your pull zone
3. Select your Storage Zone as the origin
4. Configure settings (default settings usually work)
5. Copy the **Hostname** (e.g., `your-pull-zone.b-cdn.net`)
6. Use this for `BUNNY_PULL_ZONE_URL`

### 4. Get Storage Zone Name

- Your Storage Zone name is the name you entered when creating it
- Use this for `BUNNY_STORAGE_ZONE_NAME`

### 5. Region Codes

Common region codes:
- `ny` - New York
- `la` - Los Angeles
- `sg` - Singapore
- `ld` - London
- `de` - Frankfurt
- `syd` - Sydney
- `br` - São Paulo
- `jp` - Tokyo

Find the full list in your Storage Zone settings or [Bunny CDN Documentation](https://docs.bunny.net/reference/storage-api)

### 6. Add Environment Variables

Add the variables to your `.env` file:

```env
BUNNY_STORAGE_ZONE_NAME=my-storage-zone
BUNNY_ACCESS_KEY=your-access-key-from-ftp-api-access
BUNNY_REGION=ny
BUNNY_PULL_ZONE_URL=https://my-pull-zone.b-cdn.net
```

## Usage

After setup, run batch generation as usual:

```bash
npm run generate-batch -- "your keyword"
```

The script will:
1. Generate HTML files locally
2. Upload each file to S3 (if configured)
3. **Upload each file to Bunny CDN** (if configured)
4. Update sitemap.xml incrementally
5. Upload sitemap.xml to S3 (if configured)
6. **Upload sitemap.xml to Bunny CDN** (if configured)

## Features

- ✅ Automatic Bunny CDN upload after each file generation
- ✅ Works alongside S3 upload (both can be enabled simultaneously)
- ✅ Sitemap.xml uploaded to Bunny CDN
- ✅ Error handling (continues even if Bunny CDN upload fails)
- ✅ Detailed logging for uploads
- ✅ Public URL construction from Pull Zone or Storage Zone

## URL Structure

**With Pull Zone:**
```
https://your-pull-zone.b-cdn.net/file.html
```

**Without Pull Zone (fallback):**
```
https://your-storage-zone-name.b-cdn.net/file.html
```

## Integration with S3

Bunny CDN upload works alongside S3:
- If both are configured, files will be uploaded to both
- Sitemap URLs prefer S3 URL, fallback to Bunny URL
- Google Indexing uses S3 URL if available, otherwise Bunny URL

## Error Handling

If Bunny CDN upload fails:
- Error is logged but process continues
- S3 upload (if configured) will still proceed
- Sitemap will use S3 URL if available

## Benefits of Bunny CDN

1. **Cost-Effective:** Lower pricing compared to AWS S3
2. **Global CDN:** Fast content delivery worldwide
3. **Simple API:** HTTP PUT requests, no SDK needed
4. **Pull Zones:** Built-in CDN distribution
5. **Storage + CDN:** Combined storage and CDN solution

## Troubleshooting

### Error: "BUNNY_STORAGE_ZONE_NAME is not configured"
- Check that `BUNNY_STORAGE_ZONE_NAME` is set in `.env`
- Verify the storage zone name matches your Bunny CDN dashboard

### Error: "BUNNY_ACCESS_KEY is not configured"
- Check that `BUNNY_ACCESS_KEY` is set in `.env`
- Verify you're using the Access Key from "FTP & API Access" tab (not API key)

### Error: "Failed to upload to Bunny CDN: 401"
- Check that `BUNNY_ACCESS_KEY` is correct
- Verify Access Key from Storage Zone → FTP & API Access

### Error: "Failed to upload to Bunny CDN: 404"
- Check that `BUNNY_STORAGE_ZONE_NAME` is correct
- Verify the storage zone exists in your Bunny CDN account
- Check that `BUNNY_REGION` matches your storage zone region

### Files not accessible via public URL
- Ensure Pull Zone is created and configured
- Check `BUNNY_PULL_ZONE_URL` is correct
- Verify Storage Zone is connected to Pull Zone

## API Documentation

For more information, refer to:
- [Bunny CDN Storage API Documentation](https://docs.bunny.net/reference/storage-api)
- [Bunny CDN Storage Upload Guide](https://docs.bunny.net/reference/put_-storagezonename-path-filename)
