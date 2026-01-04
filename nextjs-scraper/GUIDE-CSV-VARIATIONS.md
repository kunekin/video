# Cara Membuat CSV Variations

Panduan lengkap untuk membuat CSV Variations menggunakan AI (OpenAI).

## Langkah-langkah

### 1. Buat File Keywords CSV

Buat file `config/keywords.csv` dengan format:

```csv
keyword
makan enak di bandung
slot 88
vivalis client reviews
makan enak
```

**Cara membuat:**

```bash
cd nextjs-scraper/config

# Menggunakan terminal
cat > keywords.csv << 'EOF'
keyword
makan enak di bandung
slot 88
vivalis client reviews
EOF

# ATAU buat manual di text editor dengan format CSV
```

### 2. Set OpenAI API Key

```bash
export OPENAI_API_KEY="sk-your-api-key-here"
```

**Catatan:** Ganti `sk-your-api-key-here` dengan API key OpenAI Anda.

### 3. Generate CSV Variations

```bash
cd nextjs-scraper

# Generate variations (output default: config/keywords-variations.csv)
npm run generate-csv-variations config/keywords.csv

# ATAU dengan output file custom
npm run generate-csv-variations config/keywords.csv config/my-variations.csv
```

### 4. Tunggu Proses Selesai

Script akan:
- ✅ Membaca keywords dari CSV
- ✅ Generate 50 variations per keyword (default)
- ✅ Batch processing: 10 keywords per API call
- ✅ Save ke `keywords-variations.csv`
- ✅ Checkpoint system untuk resume jika terhenti

**Progress akan ditampilkan di console:**
```
[1/10] Processing batch: makan enak di bandung, slot 88, ...
✅ Batch 1 completed: 10 keywords, 500 variations generated
```

### 5. Hasil

File yang dihasilkan:
- 📄 `config/keywords-variations.csv` - CSV dengan semua variations
- 💾 `config/keywords-variations.checkpoint.json` - Checkpoint untuk resume

**Format CSV:**
```csv
keyword,variation_id,title,meta_description,og_description,twitter_description,paragraph_content,keywords
makan enak di bandung,1,"Title 1",...
makan enak di bandung,2,"Title 2",...
... (50 variations per keyword)
```

## Contoh Lengkap

```bash
# 1. Buat file keywords
cd nextjs-scraper/config
echo "keyword" > keywords.csv
echo "makan enak di bandung" >> keywords.csv
echo "slot 88" >> keywords.csv

# 2. Set API key
export OPENAI_API_KEY="sk-your-api-key-here"

# 3. Generate variations
cd ..
npm run generate-csv-variations config/keywords.csv

# 4. Tunggu proses selesai (~1-2 minutes untuk 3 keywords)

# 5. Verify hasil
head -5 config/keywords-variations.csv
```

## Konfigurasi

Edit `scripts/generate-csv-variations.js` untuk mengubah:

```javascript
const CONFIG = {
  keywordsPerCall: 10,        // Keywords per API call
  variationsPerKeyword: 50,   // Variations per keyword
  batchSize: 100,             // Save checkpoint every N keywords
  maxWorkers: 5,              // Parallel API calls (future)
  rateLimitDelay: 100,        // Delay between API calls (ms)
};
```

## Estimasi Waktu & Biaya

| Keywords | Estimated Time | Estimated Cost |
|----------|---------------|----------------|
| 10       | ~1-2 minutes  | ~$0.01        |
| 100      | ~10-15 min    | ~$0.10        |
| 1,000    | ~1-2 hours    | ~$1.00        |
| 10,000   | ~10-20 hours  | ~$10          |
| 100,000  | ~100-200 hours| ~$100         |

**Catatan:** Waktu dan biaya bervariasi tergantung token usage dan rate limits.

## Checkpoint & Resume

Script otomatis menyimpan checkpoint. Jika proses terhenti:

1. **Run lagi dengan file yang sama:**
   ```bash
   npm run generate-csv-variations config/keywords.csv
   ```

2. **Script akan:**
   - ✅ Load checkpoint terakhir
   - ✅ Skip keywords yang sudah processed
   - ✅ Lanjut dari keyword terakhir

## Troubleshooting

### Error: OPENAI_API_KEY not set
```bash
export OPENAI_API_KEY="sk-your-api-key-here"
```

### Error: Rate limit exceeded
- Increase `rateLimitDelay` di CONFIG (e.g., 200ms, 500ms)
- Reduce `keywordsPerCall` (e.g., dari 10 ke 5)

### Error: Invalid JSON response
- Script akan retry otomatis (3 attempts)
- Jika masih gagal, keyword akan di-mark sebagai failed
- Check checkpoint.json untuk failed keywords

### Large CSV file
- CSV dengan banyak variations bisa besar (500MB-1GB untuk 100k keywords)
- Gunakan streaming untuk read (sudah implemented)
- Consider splitting ke multiple files jika perlu

## Setelah CSV Variations Dibuat

Setelah CSV variations dibuat, generate HTML akan otomatis menggunakan CSV (bukan AI):

```bash
# Generate HTML (akan pakai CSV, bukan AI)
npm run generate-dynamic "makan enak di bandung"

# System akan:
# 1. Auto-detect keywords-variations.csv
# 2. Random pick 1 variation dari CSV
# 3. Generate HTML (NO API calls, NO cost)
```

## Next Steps

1. ✅ Generate CSV variations (ONE-TIME, dengan AI)
2. ✅ Generate HTML files (REPEATABLE, NO API, NO cost)
3. ✅ Regenerate HTML unlimited times dengan variations berbeda

