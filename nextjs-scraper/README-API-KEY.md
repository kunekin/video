# Cara Set OpenAI API Key

API key tidak disimpan di code untuk keamanan. Berikut cara set API key:

## Option 1: Menggunakan .env File (Recommended)

### 1. Install dotenv (sudah included di package.json)
```bash
npm install
```

### 2. Buat file .env
```bash
cd nextjs-scraper
cp .env.example .env
```

### 3. Edit .env file
```bash
# Buka .env file dan ganti dengan API key Anda
OPENAI_API_KEY=sk-your-api-key-here
```

### 4. Run script
```bash
npm run generate-csv-variations config/keywords.csv
```

**Catatan:** File `.env` sudah di `.gitignore`, jadi tidak akan ter-commit ke GitHub.

## Option 2: Set di Terminal (Temporary)

### Set untuk session ini saja:
```bash
export OPENAI_API_KEY="sk-your-api-key-here"
npm run generate-csv-variations config/keywords.csv
```

### Set sebelum command (one-liner):
```bash
OPENAI_API_KEY="sk-your-api-key-here" npm run generate-csv-variations config/keywords.csv
```

## Option 3: Set di Shell Profile (Permanent untuk semua project)

### Untuk zsh (Mac/Linux):
```bash
echo 'export OPENAI_API_KEY="sk-your-api-key-here"' >> ~/.zshrc
source ~/.zshrc
```

### Untuk bash:
```bash
echo 'export OPENAI_API_KEY="sk-your-api-key-here"' >> ~/.bashrc
source ~/.bashrc
```

## Cara Mendapatkan API Key

1. Buka https://platform.openai.com/api-keys
2. Login atau buat akun
3. Klik "Create new secret key"
4. Copy API key (format: `sk-...`)
5. Set menggunakan salah satu option di atas

## Verifikasi API Key

```bash
# Check apakah API key sudah set
echo $OPENAI_API_KEY

# ATAU test dengan script
npm run generate-csv-variations config/keywords-example.csv
```

## Troubleshooting

### Error: Missing credentials
- Pastikan API key sudah di-set (cek dengan `echo $OPENAI_API_KEY`)
- Jika pakai .env, pastikan file `.env` ada di folder `nextjs-scraper/`
- Pastikan format API key benar: `sk-...`

### Error: Invalid API key
- Pastikan API key valid dan aktif
- Check di https://platform.openai.com/api-keys
- Pastikan account memiliki credits

## Security Notes

- ✅ **JANGAN** commit API key ke GitHub
- ✅ File `.env` sudah di `.gitignore`
- ✅ Gunakan `.env.example` sebagai template
- ✅ Jangan share API key dengan orang lain

