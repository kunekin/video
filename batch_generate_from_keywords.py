#!/usr/bin/env python3
"""
Batch Generate Articles dari File Keywords
- Baca keywords dari file (satu per line)
- Generate artikel untuk setiap keyword
- Optional: Generate related articles juga
- Support parallel processing dengan multiple workers
"""

import os
import sys
import threading
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# Import generate functions
try:
    from generate_article_template_ai import generate_article_template
    from batch_generate_related_articles import batch_generate_related
except ImportError:
    print("❌ Required scripts tidak ditemukan")
    print("   Pastikan generate_article_template_ai.py dan batch_generate_related_articles.py ada")
    sys.exit(1)

def batch_generate_from_keywords(keywords_file, output_dir='output', 
                                 generate_related=False, max_depth=1,
                                 base_url='https://packaginginsights.b-cdn.net',
                                 site_name='Packaging Insights',
                                 num_workers=5):
    """
    Generate articles dari file keywords
    
    Args:
        keywords_file: Path ke file dengan keywords (satu per line)
        output_dir: Output directory
        generate_related: Generate related articles juga?
        max_depth: Max depth untuk related articles
        base_url: Base URL
        site_name: Site name
        num_workers: Number of parallel workers (default: 5)
    """
    if not os.path.exists(keywords_file):
        print(f"❌ File tidak ditemukan: {keywords_file}")
        return []
    
    # Read keywords
    with open(keywords_file, 'r', encoding='utf-8') as f:
        keywords = [line.strip() for line in f if line.strip()]
    
    if not keywords:
        print("⚠️  Tidak ada keywords ditemukan di file")
        return []
    
    print("=" * 70)
    print("🚀 BATCH GENERATE DARI KEYWORDS")
    print("=" * 70)
    print()
    print(f"Keywords file: {keywords_file}")
    print(f"Total keywords: {len(keywords)}")
    print(f"Output directory: {output_dir}")
    print(f"Generate related: {'Yes' if generate_related else 'No'}")
    if generate_related:
        print(f"Max depth: {max_depth}")
    print(f"Workers: {num_workers} (parallel processing)")
    print()
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Thread-safe list untuk generated files
    generated_files = []
    files_lock = threading.Lock()
    progress_lock = threading.Lock()
    completed = [0]
    
    def process_keyword(keyword, index):
        """Process single keyword (worker function)"""
        try:
            with progress_lock:
                completed[0] += 1
                current = completed[0]
                print(f"[{current}/{len(keywords)}] Processing: {keyword}")
            
            # Generate artikel utama
            result = generate_article_template(
                keyword,
                output_file=None,  # Auto-generate filename
                base_url=base_url,
                site_name=site_name
            )
            
            if result:
                with files_lock:
                    generated_files.append(result)
                print(f"   ✅ Generated: {result}")
                
                # Generate related articles jika diminta
                if generate_related:
                    print(f"   🔄 Generating related articles...")
                    related_files = batch_generate_related(
                        result,
                        output_dir=output_dir,
                        max_depth=max_depth,
                        base_url=base_url,
                        site_name=site_name
                    )
                    with files_lock:
                        generated_files.extend(related_files)
            else:
                print(f"   ❌ Failed to generate: {keyword}")
        
        except Exception as e:
            print(f"   ❌ Error processing '{keyword}': {e}")
    
    # Process dengan parallel workers
    if num_workers > 1:
        print(f"🚀 Starting parallel processing with {num_workers} workers...")
        print()
        
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = {executor.submit(process_keyword, kw, i): kw 
                      for i, kw in enumerate(keywords, 1)}
            
            for future in as_completed(futures):
                keyword = futures[future]
                try:
                    future.result()  # Get result (or raise exception)
                except Exception as e:
                    print(f"   ❌ Exception for '{keyword}': {e}")
    else:
        # Sequential processing (no parallel)
        for i, keyword in enumerate(keywords, 1):
            process_keyword(keyword, i)
    
    return generated_files

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("=" * 70)
        print("🚀 BATCH GENERATE DARI KEYWORDS")
        print("=" * 70)
        print()
        print("Usage: python3 batch_generate_from_keywords.py <keywords_file> [options]")
        print()
        print("Options:")
        print("  --output-dir DIR       Output directory (default: output)")
        print("  --generate-related     Generate related articles juga")
        print("  --max-depth N          Max depth untuk related (default: 1)")
        print("  --base-url URL         Base URL")
        print("  --site-name NAME       Site name")
        print("  --workers N            Number of parallel workers (default: 5)")
        print()
        print("Example:")
        print("  # Buat file keywords.txt")
        print("  echo -e 'slot gacor\\nrtp slot tertinggi\\nbocoran slot' > keywords.txt")
        print()
        print("  # Generate artikel saja")
        print("  python3 batch_generate_from_keywords.py keywords.txt")
        print()
        print("  # Generate artikel + related articles")
        print("  python3 batch_generate_from_keywords.py keywords.txt --generate-related")
        print()
        sys.exit(1)
    
    keywords_file = sys.argv[1]
    output_dir = 'output'
    generate_related = False
    max_depth = 1
    base_url = 'https://packaginginsights.b-cdn.net'
    site_name = 'Packaging Insights'
    num_workers = 5
    
    # Parse arguments
    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == '--output-dir' and i + 1 < len(sys.argv):
            output_dir = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--generate-related':
            generate_related = True
            i += 1
        elif sys.argv[i] == '--max-depth' and i + 1 < len(sys.argv):
            max_depth = int(sys.argv[i + 1])
            i += 2
        elif sys.argv[i] == '--base-url' and i + 1 < len(sys.argv):
            base_url = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--site-name' and i + 1 < len(sys.argv):
            site_name = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--workers' and i + 1 < len(sys.argv):
            num_workers = int(sys.argv[i + 1])
            i += 2
        else:
            i += 1
    
    generated = batch_generate_from_keywords(
        keywords_file,
        output_dir=output_dir,
        generate_related=generate_related,
        max_depth=max_depth,
        base_url=base_url,
        site_name=site_name,
        num_workers=num_workers
    )
    
    # Summary
    print()
    print("=" * 70)
    print("✅ BATCH GENERATE COMPLETE")
    print("=" * 70)
    print()
    print(f"Total files generated: {len(generated)}")
    print()
    if generated:
        print("Generated files:")
        for file in generated[:10]:
            print(f"   - {file}")
        if len(generated) > 10:
            print(f"   ... and {len(generated) - 10} more")
    print()
    print(f"Output directory: {output_dir}")
    print()

