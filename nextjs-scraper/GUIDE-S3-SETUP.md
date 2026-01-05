# 📦 Guide: Setup Amazon S3 untuk Upload HTML Files

## 🎯 Overview

Guide ini menjelaskan cara setup Amazon S3 untuk menyimpan file HTML yang di-generate, dan cara mengupload file-file tersebut ke S3.

---

## 📋 Prerequisites

1. **AWS Account** - Sudah punya AWS account
2. **AWS Credentials** - Access Key ID dan Secret Access Key
3. **S3 Bucket** - Sudah dibuat atau akan dibuat

---

## 🔧 Step 1: Setup S3 Bucket

### 1.1. Create S3 Bucket

1. Login ke [AWS Console](https://console.aws.amazon.com/)
2. Navigate ke **S3** service
3. Click **Create bucket**
4. Configure:
   - **Bucket name**: `your-bucket-name` (harus unique globally)
   - **Region**: Pilih region terdekat (e.g., `us-east-1`, `ap-southeast-1`)
   - **Block Public Access**: 
     - ✅ **Uncheck** "Block all public access" (jika ingin file bisa diakses public)
     - Atau biarkan checked jika hanya untuk private storage
   - **Bucket Versioning**: Optional (disable untuk save cost)
   - **Default encryption**: Optional (recommended: Enable)
5. Click **Create bucket**

### 1.2. Configure Bucket Permissions (Jika Public Access)

Jika ingin file HTML bisa diakses public (untuk website):

1. Go to bucket → **Permissions** tab
2. **Block public access**: Edit → Uncheck all → Save
3. **Bucket policy**: Add policy berikut:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

**⚠️ Warning**: Policy ini membuat semua file di bucket bisa diakses public. Pastikan ini sesuai dengan kebutuhan Anda.

### 1.3. Enable Static Website Hosting (Optional)

Jika ingin menggunakan S3 sebagai static website:

1. Go to bucket → **Properties** tab
2. Scroll to **Static website hosting**
3. Click **Edit**
4. Enable static website hosting
5. Set **Index document**: `index.html` (optional)
6. Set **Error document**: `error.html` (optional)
7. Save

**Website URL** akan seperti: `http://your-bucket-name.s3-website-us-east-1.amazonaws.com`

---

## 🔑 Step 2: Setup AWS Credentials

### 2.1. Create IAM User (Recommended)

**Jangan gunakan root AWS credentials!** Buat IAM user dengan permission terbatas:

1. Go to **IAM** → **Users** → **Create user**
2. Username: `s3-uploader` (atau nama lain)
3. **Access type**: ✅ Programmatic access
4. **Permissions**: Attach policy `AmazonS3FullAccess` (atau custom policy untuk lebih secure)
5. **Review** → **Create user**
6. **Save credentials**:
   - Access Key ID
   - Secret Access Key
   - ⚠️ **PENTING**: Secret Access Key hanya muncul sekali! Simpan dengan aman.

### 2.2. Add Credentials to `.env` File

Edit `nextjs-scraper/.env`:

```bash
# AWS Credentials
AWS_ACCESS_KEY_ID=your-access-key-id-here
AWS_SECRET_ACCESS_KEY=your-secret-access-key-here
AWS_REGION=us-east-1

# S3 Configuration
S3_BUCKET_NAME=your-bucket-name
S3_PREFIX=html-files/  # Optional: prefix for S3 keys (e.g., 'html-files/' or leave empty)
S3_MAX_CONCURRENT=10   # Optional: max concurrent uploads (default: 10)
```

**⚠️ Security**: Jangan commit `.env` file ke Git! File ini sudah ada di `.gitignore`.

---

## 🚀 Step 3: Install Dependencies

```bash
cd nextjs-scraper
npm install @aws-sdk/client-s3
```

---

## 📤 Step 4: Upload Files to S3

### 4.1. Upload All Files from Output Directory

```bash
npm run upload-s3
```

Atau langsung:

```bash
node scripts/upload-to-s3.js
```

### 4.2. Upload Specific Files

Edit `scripts/upload-to-s3.js` untuk filter files tertentu, atau gunakan script custom.

---

## 🔍 Step 5: Verify Upload

### 5.1. Check via AWS Console

1. Go to S3 bucket
2. Navigate to folder (jika ada prefix)
3. Verify files ada di sana

### 5.2. Check via AWS CLI

```bash
aws s3 ls s3://your-bucket-name/html-files/ --recursive
```

### 5.3. Test Public URL

Jika bucket public, test URL:

```
https://your-bucket-name.s3.us-east-1.amazonaws.com/html-files/your-file.html
```

---

## 🔄 Step 6: Auto-Upload After Generation (Optional)

### Option A: Modify `generate-batch-html.js`

Tambahkan auto-upload setelah generate:

```javascript
// At the end of generate-batch-html.js
const { uploadFileToS3 } = require('./upload-to-s3');

// After generating each file
await uploadFileToS3(outputPath, s3Key);
```

### Option B: Separate Upload Script

Generate dulu, kemudian upload:

```bash
# Step 1: Generate files
npm run generate-batch config/keywords-variations.csv

# Step 2: Upload to S3
npm run upload-s3
```

---

## 📊 Step 7: Monitor Costs

### S3 Pricing (as of 2024)

- **Storage**: ~$0.023 per GB/month (Standard storage)
- **PUT requests**: ~$0.005 per 1,000 requests
- **GET requests**: ~$0.0004 per 1,000 requests
- **Data transfer OUT**: ~$0.09 per GB (first 10 TB)

### Cost Estimation for 100k Files

- **Storage**: 100k files × 88KB = ~8.8 GB = ~$0.20/month
- **PUT requests**: 100k requests = ~$0.50 (one-time)
- **GET requests**: Depends on traffic
- **Data transfer**: Depends on traffic

**Total**: ~$0.70 one-time + ~$0.20/month storage

---

## 🛠️ Troubleshooting

### Error: "Access Denied"

- Check IAM user permissions
- Check bucket policy
- Verify credentials di `.env`

### Error: "Bucket not found"

- Verify bucket name di `.env`
- Check region setting

### Error: "Invalid credentials"

- Verify `AWS_ACCESS_KEY_ID` dan `AWS_SECRET_ACCESS_KEY`
- Pastikan tidak ada extra spaces

### Upload Slow

- Increase `S3_MAX_CONCURRENT` di `.env` (default: 10)
- Check network connection
- Consider using S3 Transfer Acceleration (extra cost)

---

## 📝 Example `.env` Configuration

```bash
# OpenAI API (for content generation)
OPENAI_API_KEY=sk-...

# Worker Configuration
MAX_WORKERS=10

# AWS Credentials
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1

# S3 Configuration
S3_BUCKET_NAME=my-html-files-bucket
S3_PREFIX=html-files/
S3_MAX_CONCURRENT=20
```

---

## 🎯 Next Steps

1. ✅ Setup S3 bucket
2. ✅ Configure AWS credentials
3. ✅ Test upload dengan beberapa files
4. ✅ Verify public access (jika diperlukan)
5. ✅ Setup auto-upload (optional)
6. ✅ Monitor costs

---

## 📚 Additional Resources

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/sdk-for-javascript/v3/)
- [S3 Pricing Calculator](https://calculator.aws/)

---

**✨ Setup complete! File HTML siap di-upload ke S3.**

