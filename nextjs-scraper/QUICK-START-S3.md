# 🚀 Quick Start: Upload ke S3

## 📋 Prerequisites

1. ✅ AWS Account
2. ✅ S3 Bucket sudah dibuat
3. ✅ AWS Credentials (Access Key ID & Secret Access Key)

---

## ⚡ Quick Setup (5 Menit)

### Step 1: Setup AWS Credentials

Edit file `.env` di `nextjs-scraper/.env`:

```bash
# AWS Credentials
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=us-east-1

# S3 Configuration
S3_BUCKET_NAME=your-bucket-name
S3_PREFIX=html-files/  # Optional: bisa dikosongkan
S3_MAX_CONCURRENT=10   # Optional: default 10
```

### Step 2: Install Dependencies (jika belum)

```bash
cd nextjs-scraper
npm install
```

### Step 3: Upload Files

```bash
npm run upload-s3
```

**Done!** ✅

---

## 📤 Cara Upload

### Option 1: Upload Semua Files dari `output/`

```bash
npm run upload-s3
```

### Option 2: Upload dari EC2

```bash
# SSH ke EC2
ssh -i nextjs-scraper.pem ec2-user@34.234.84.239

# Navigate ke project
cd content-local-ai/nextjs-scraper

# Setup .env (jika belum)
nano .env

# Upload
npm run upload-s3
```

---

## 🔍 Verify Upload

### Check via AWS Console

1. Login ke [AWS Console](https://console.aws.amazon.com/)
2. Go to **S3** → Your bucket
3. Check files ada di sana

### Check via Command Line

```bash
aws s3 ls s3://your-bucket-name/html-files/ --recursive | head -10
```

### Test Public URL

Jika bucket public:

```
https://your-bucket-name.s3.us-east-1.amazonaws.com/html-files/your-file.html
```

---

## 📝 Example `.env` Configuration

```bash
# OpenAI API
OPENAI_API_KEY=sk-...

# Workers
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

## 🛠️ Troubleshooting

### Error: "Access Denied"
- ✅ Check IAM user permissions
- ✅ Check bucket policy
- ✅ Verify credentials

### Error: "Bucket not found"
- ✅ Verify bucket name
- ✅ Check region setting

### Upload Slow
- ✅ Increase `S3_MAX_CONCURRENT` (default: 10)
- ✅ Check network connection

---

## 📚 Full Guide

Untuk setup lengkap (create bucket, IAM user, permissions), lihat:
- `GUIDE-S3-SETUP.md`

---

**✨ Siap upload ke S3!**

