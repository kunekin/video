# CSV Variations Generator

Script untuk pre-generate CSV dengan 50-100 variasi konten per keyword menggunakan batch API OpenAI. Strategi ini mengurangi rate limit secara drastis (20x reduction) dan memungkinkan HTML generation tanpa API calls.

## Strategi

1. **Preprocessing (One-time)**: Generate 50-100 variasi konten per keyword menggunakan batch API
2. **HTML Generation**: Baca dari CSV, random pick 1 variasi, generate HTML (no API calls)

## Manfaat

- ✅ **Rate limit reduction**: 100k keywords → 5k API calls (20x reduction!)
- ✅ **Fast preprocessing**: ~10-20 minutes (vs 6-10 hours)
- ✅ **HTML generation**: No API, instant, repeatable
- ✅ **Content variety**: 50-100 unique variations per keyword
- ✅ **Cost effective**: One-time preprocessing, unlimited regenerations

## Usage

### 1. Generate CSV Variations

```bash
# Set OpenAI API key
export OPENAI_API_KEY="your-api-key"

# Generate variations from keywords file
npm run generate-csv-variations config/keywords.csv

# Or specify output file
npm run generate-csv-variations config/keywords.csv config/keywords-variations.csv
```

### 2. Generate HTML (Auto-detect Variations CSV)

Script `generate-dynamic-html.js` akan otomatis:
1. Cek `config/keywords-variations.csv` terlebih dahulu
2. Jika ada, gunakan variations (random pick 1 variasi per keyword)
3. Jika tidak ada, fallback ke `config/keywords.csv` atau AI

```bash
# Generate single HTML
npm run generate-dynamic "makan enak"

# Batch processing
npm run generate-batch config/keywords.csv
```

## CSV Structure

### Variations CSV (keywords-variations.csv)

```csv
keyword,variation_id,title,meta_description,og_description,twitter_description,paragraph_content,keywords
makan enak,1,"Makan Enak di Bandung: Temukan Kuliner Terbaik",...
makan enak,2,"Makan Enak Jakarta: Rekomendasi Restoran Favorit",...
makan enak,3,"Makan Enak Surabaya: Cita Rasa Nusantara",...
... (50-100 variasi per keyword)
```

### Regular CSV (keywords.csv)

```csv
keyword,title,meta_description,og_description,twitter_description,paragraph_content,keywords
makan enak,"Makan Enak di Bandung: Temukan Kuliner Terbaik",...
```

## Configuration

Edit `generate-csv-variations.js` untuk mengubah:

```javascript
const CONFIG = {
  keywordsPerCall: 10,        // Number of keywords per API call
  variationsPerKeyword: 50,   // Number of variations to generate per keyword
  batchSize: 100,             // Save checkpoint every N keywords
  maxWorkers: 5,              // Number of parallel API calls
  rateLimitDelay: 100,        // Delay between API calls (ms)
};
```

## Checkpoint & Resume

Script otomatis menyimpan checkpoint di `{output-file}.checkpoint.json`. Jika proses terhenti, jalankan lagi dengan file yang sama untuk resume dari checkpoint terakhir.

## Performance

### Preprocessing (100k keywords)
- **API Calls**: 5k-10k (vs 100k on-demand)
- **Time**: ~10-20 minutes (with parallel workers)
- **Output**: 5M-10M rows CSV (~500MB-1GB)

### HTML Generation (100k files)
- **API Calls**: 0 (read from CSV)
- **Time**: ~1-2 hours (parallel workers)
- **Repeatable**: Unlimited regenerations, no API cost

## Rate Limit Impact

| Approach | API Calls | Time |
|----------|-----------|------|
| On-demand AI | 100k | 6-10 hours |
| Pre-gen CSV (1 var) | 100k | 6-10 hours |
| **Pre-gen CSV (50-100 var)** | **5k-10k** | **10-20 min** |

**Reduction: 20x fewer calls, 30-60x faster!**

## Troubleshooting

### Error: OPENAI_API_KEY not set
```bash
export OPENAI_API_KEY="your-api-key"
```

### Error: Rate limit exceeded
- Increase `rateLimitDelay` in CONFIG
- Reduce `keywordsPerCall` or `maxWorkers`

### Large CSV file
- CSV dengan 5M-10M rows bisa mencapai 500MB-1GB
- Gunakan streaming untuk read (sudah implemented)
- Consider splitting into multiple files jika perlu

## Example Workflow

```bash
# Step 1: Generate variations CSV (one-time)
npm run generate-csv-variations config/keywords.csv

# Step 2: Generate HTML files (repeatable, no API)
npm run generate-batch config/keywords.csv

# Step 3: Regenerate HTML with different variations (no API cost)
npm run generate-batch config/keywords.csv
```

