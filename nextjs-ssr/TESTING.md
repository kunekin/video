# Testing Scraping (Without AI)

## Status

✅ AI Generation: **DISABLED** (temporary)  
✅ Scraping: **ENABLED**  
✅ Mock AI Content: Using simple placeholder

## Purpose

Fokus testing scraping URL untuk memastikan:
1. HTML ter-scrape dengan benar
2. CSS ter-load dengan benar
3. JavaScript ter-load dengan benar
4. Tampilan sesuai dengan original site

## Test Steps

### 1. Start Development Server

```bash
cd nextjs-ssr
npm run dev
```

### 2. Visit Test URL

Open browser: `http://localhost:3000/test-scrape`

### 3. Verify Scraping

**Visual Check:**
- Tampilan harus mirip dengan: `https://www.packaginginsights.com/video/drinktec-2025-sidel-debuts-laser-blowing.html`
- Layout harus teratur
- Images harus muncul
- Fonts harus sesuai

**DevTools Check:**
1. Open DevTools (F12)
2. Go to Network tab
3. Refresh page
4. Verify:
   - CSS files loaded (status 200)
   - JS files loaded (status 200)
   - No 404 errors

**View Source Check:**
1. Right-click → View Page Source
2. Verify:
   - HTML structure lengkap
   - CSS links ada di `<head>`
   - Script tags ada

### 4. Check Console Logs

Terminal logs should show:
```
🚀 Skipping AI generation (testing scraping only)
✅ Using mock AI content (testing scraping)
🌐 Fetching original HTML from: https://www.packaginginsights.com/video/drinktec-2025-sidel-debuts-laser-blowing.html
📝 Replacing content in original HTML
✅ Content ready, size: XXXXX bytes
📦 Head assets: X CSS, X scripts, X inline styles
```

## Expected Results

✅ HTML ter-scrape dari packaginginsights.com  
✅ CSS ter-load (check Network tab)  
✅ JavaScript ter-load  
✅ Tampilan sesuai original site  
✅ No errors in console  

## Troubleshooting

### Tampilan tidak beraturan
- Check Network tab untuk CSS 404 errors
- Verify CSS URLs converted to absolute URLs
- Check console for errors

### JavaScript tidak berfungsi
- Check Network tab untuk JS 404 errors
- Verify script URLs converted to absolute URLs
- Check console for JavaScript errors

### Content tidak muncul
- Check terminal logs untuk scraping errors
- Verify URL accessible: `curl https://www.packaginginsights.com/video/drinktec-2025-sidel-debuts-laser-blowing.html`
- Check if HTML fetch successful

## Next Steps

**Jika scraping OK:**
1. Enable AI generation kembali
2. Replace mock AI content dengan real OpenAI API call
3. Test AI content replacement

**Code changes needed to re-enable AI:**
In `pages/[keyword].tsx`, replace:
```typescript
// TEMPORARY: Skip AI generation for testing scraping
console.log(`🚀 Skipping AI generation (testing scraping only)`);
const aiContent = { ... }; // Mock content
```

With:
```typescript
// Generate AI content
console.log(`🚀 Generating AI content for keyword: ${keyword}`);
const aiContent = await generateAIContent(keyword, {
  openaiApiKey,
  aiEnabled: true,
  timeout: 25000,
});
```

## Test URLs

- `/test-scrape` - Test scraping functionality
- `/makan-enak` - Test with different keyword
- `/video-content` - Test with different keyword
- `/any-keyword` - All keywords work the same (fixed URL scraping)

## Notes

- AI generation di-disable temporary untuk fokus testing scraping
- Mock AI content digunakan untuk placeholder
- Original HTML di-scrape dan di-modify dengan mock content
- Setelah scraping verified OK, enable AI kembali

