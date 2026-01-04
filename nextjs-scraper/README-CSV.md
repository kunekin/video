# CSV/XLSX Support untuk Content Generation

Sistem ini sekarang mendukung CSV/XLSX file untuk content generation dengan hybrid approach (CSV primary, AI fallback).

## 📋 Struktur File CSV/XLSX

File: `config/keywords.csv` atau `config/keywords.xlsx`

### Columns (semua optional kecuali `keyword`):

1. **keyword** (required) - Keyword utama
2. **title** (optional) - Title untuk HTML
3. **meta_description** (optional) - Meta description (155-160 chars)
4. **og_description** (optional) - OG description (200 chars)
5. **twitter_description** (optional) - Twitter description (200 chars)
6. **paragraph_content** (optional) - Paragraph content (250-350 chars)
7. **keywords** (optional) - Comma-separated keywords

### Contoh Format CSV:

```csv
keyword,title,meta_description,og_description,twitter_description,paragraph_content,keywords
slot 88,Unlock Big Wins with Slot 88: Your Ultimate Guide,Discover Slot 88 and unlock big wins!...,Step into the world of Slot 88...,🎰 Ready to win big?...,Welcome to the exciting world of Slot 88!...,slot 88, Slot 88 tips, online slots
makan enak di bandung,Makan Enak di Bandung: Temukan Rekomendasi Kuliner Terbaik,Makan enak di Bandung!...,Sedang mencari makan enak di Bandung?...,🍽️ Makan enak di Bandung!...,Jika Anda mencari pengalaman makan...,makan enak di Bandung, kuliner Bandung
```

## 🚀 Cara Penggunaan

### 1. Single Keyword (dengan CSV/XLSX support):

```bash
npm run generate-dynamic "slot 88"
```

**Cara kerja:**
- Script akan mencari keyword di file `config/keywords.csv`
- Jika ditemukan → gunakan data dari CSV
- Jika tidak ditemukan → fallback ke AI generation

### 2. Batch Processing (multiple keywords):

```bash
npm run generate-batch config/keywords.csv
```

atau untuk XLSX:

```bash
npm run generate-batch config/keywords.xlsx
```

**Cara kerja:**
- Script membaca semua keyword dari file CSV/XLSX
- Process setiap keyword secara sequential
- Generate HTML file untuk setiap keyword

## 💡 Hybrid Approach

Sistem menggunakan **hybrid approach**:

1. **Primary: CSV/XLSX**
   - Jika keyword ada di file → gunakan data dari file
   - Fast, free, consistent

2. **Fallback: AI**
   - Jika keyword tidak ada di file → generate dengan AI
   - Auto-generation untuk keyword baru

## 📊 Kelebihan CSV/XLSX

✅ **FREE** - Tidak ada cost per generation
✅ **FAST** - Tidak perlu API call
✅ **CONSISTENT** - Hasil selalu sama
✅ **BULK PROCESSING** - Bisa process ratusan keyword sekaligus
✅ **OFFLINE** - Tidak perlu internet connection
✅ **CONTROL** - Full control atas konten

## 📝 Contoh File

File contoh sudah tersedia di: `config/keywords.csv`

Anda bisa edit file ini dengan:
- Excel
- Google Sheets
- Text editor (untuk CSV)
- LibreOffice Calc

## 🔧 Dependencies

- `csv-parser` - Untuk membaca CSV files
- `xlsx` - Untuk membaca XLSX/XLS files

Sudah terinstall di `package.json`.
