#!/usr/bin/env python3
"""
Batch Generate Related Articles
- Extract related topics dari artikel yang sudah di-generate
- Generate file HTML untuk setiap related topic
- Support recursive generation (related dari related)
- Support parallel processing dengan multiple workers
"""

import os
import re
import json
import threading
from pathlib import Path
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed

# Import generate function
try:
    from generate_article_template_ai import generate_article_template, detect_language
except ImportError:
    print("❌ generate_article_template_ai.py tidak ditemukan")
    print("   Pastikan file ada di directory yang sama")
    exit(1)

def extract_related_topics(html_file):
    """
    Extract related topics dari HTML file yang sudah di-generate
    Returns: List of dict dengan title, url, description
    """
    if not os.path.exists(html_file):
        print(f"❌ File tidak ditemukan: {html_file}")
        return []
    
    with open(html_file, 'r', encoding='utf-8') as f:
        html = f.read()
    
    soup = BeautifulSoup(html, 'html.parser')
    related_topics = []
    
    # Extract dari sidebar (Related Articles section)
    sidebar_sections = soup.find_all('div', class_='sidebar-section')
    for section in sidebar_sections:
        h3 = section.find('h3')
        if h3 and ('Related' in h3.string or 'Terkait' in h3.string):
            links = section.find_all('a')
            for link in links:
                title = link.string.strip() if link.string else ''
                url = link.get('href', '#')
                if title and title not in ['Related Articles', 'Artikel Terkait']:
                    related_topics.append({
                        'title': title,
                        'url': url,
                        'description': ''
                    })
    
    # Extract dari Related Articles grid (di bawah artikel)
    related_cards = soup.find_all('div', class_='related-card')
    for card in related_cards:
        link = card.find('a')
        if link:
            title = link.string.strip() if link.string else ''
            url = link.get('href', '#')
            desc_elem = card.find('p')
            description = desc_elem.string.strip() if desc_elem and desc_elem.string else ''
            
            if title:
                # Check if already exists (avoid duplicates)
                if not any(t['title'] == title for t in related_topics):
                    related_topics.append({
                        'title': title,
                        'url': url,
                        'description': description
                    })
    
    return related_topics

def generate_url_from_keyword(keyword, base_url='https://packaginginsights.b-cdn.net'):
    """
    Generate URL dari keyword (slug)
    """
    slug = re.sub(r'[^a-z0-9]+', '-', keyword.lower())
    return f'{base_url}/articles/{slug}.html'

def batch_generate_related(html_file, output_dir='output', max_depth=1, 
                          base_url='https://packaginginsights.b-cdn.net',
                          site_name='Packaging Insights',
                          processed=None,
                          num_workers=5):
    """
    Generate related articles dari HTML file
    
    Args:
        html_file: Path ke HTML file yang sudah di-generate
        output_dir: Directory untuk output files
        max_depth: Maximum depth untuk recursive generation (0 = hanya direct related)
        base_url: Base URL untuk canonical
        site_name: Site name
        processed: Set of already processed keywords (untuk avoid infinite loop)
        num_workers: Number of parallel workers (default: 5)
    """
    if processed is None:
        processed = set()
    
    # Thread-safe set untuk processed keywords
    processed_lock = threading.Lock()
    
    if max_depth < 0:
        return []
    
    print("=" * 70)
    print("🚀 BATCH GENERATE RELATED ARTICLES")
    print("=" * 70)
    print()
    print(f"Source file: {html_file}")
    print(f"Max depth: {max_depth}")
    print()
    
    # Extract related topics
    related_topics = extract_related_topics(html_file)
    
    if not related_topics:
        print("⚠️  Tidak ada related topics ditemukan")
        return []
    
    print(f"📊 Found {len(related_topics)} related topics")
    print(f"Workers: {num_workers} (parallel processing)")
    print()
    
    # Thread-safe list untuk generated files
    generated_files = []
    files_lock = threading.Lock()
    progress_lock = threading.Lock()
    completed = [0]
    
    def process_topic(topic, index):
        """Process single topic (worker function)"""
        keyword = topic['title']
        
        # Thread-safe check dan add to processed
        with processed_lock:
            if keyword in processed:
                with progress_lock:
                    completed[0] += 1
                    current = completed[0]
                print(f"[{current}/{len(related_topics)}] ⏭️  Skip (already processed): {keyword}")
                return None
            processed.add(keyword)
        
        try:
            with progress_lock:
                completed[0] += 1
                current = completed[0]
                print(f"[{current}/{len(related_topics)}] Processing: {keyword}")
            
            # Generate file
            safe_keyword = re.sub(r'[^a-z0-9]+', '-', keyword.lower())
            output_file = os.path.join(output_dir, f"{safe_keyword}.html")
            
            result = generate_article_template(
                keyword, 
                output_file=output_file,
                base_url=base_url,
                site_name=site_name
            )
            
            if result:
                with files_lock:
                    generated_files.append(result)
                print(f"   ✅ Generated: {result}")
                
                # Recursive: Generate related dari related
                if max_depth > 0:
                    print(f"   🔄 Generating related articles (depth {max_depth-1})...")
                    related_files = batch_generate_related(
                        result,
                        output_dir=output_dir,
                        max_depth=max_depth - 1,
                        base_url=base_url,
                        site_name=site_name,
                        processed=processed,
                        num_workers=num_workers
                    )
                    with files_lock:
                        generated_files.extend(related_files)
                return result
            else:
                print(f"   ❌ Failed to generate: {keyword}")
                return None
        
        except Exception as e:
            print(f"   ❌ Error processing '{keyword}': {e}")
            return None
    
    # Process dengan parallel workers
    if num_workers > 1 and len(related_topics) > 1:
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = {executor.submit(process_topic, topic, i): topic 
                      for i, topic in enumerate(related_topics, 1)}
            
            for future in as_completed(futures):
                topic = futures[future]
                try:
                    future.result()  # Get result (or raise exception)
                except Exception as e:
                    print(f"   ❌ Exception for '{topic['title']}': {e}")
    else:
        # Sequential processing (no parallel atau hanya 1 topic)
        for i, topic in enumerate(related_topics, 1):
            process_topic(topic, i)
    
    return generated_files

def batch_generate_from_directory(directory, output_dir='output', max_depth=1,
                                 base_url='https://packaginginsights.b-cdn.net',
                                 site_name='Packaging Insights',
                                 num_workers=5):
    """
    Batch generate related articles dari semua HTML files di directory
    """
    directory = Path(directory)
    if not directory.exists():
        print(f"❌ Directory tidak ditemukan: {directory}")
        return []
    
    html_files = list(directory.glob('*.html'))
    
    if not html_files:
        print(f"⚠️  Tidak ada HTML files ditemukan di {directory}")
        return []
    
    print("=" * 70)
    print("🚀 BATCH GENERATE FROM DIRECTORY")
    print("=" * 70)
    print()
    print(f"Directory: {directory}")
    print(f"Found {len(html_files)} HTML files")
    print()
    
    all_generated = []
    processed = set()
    
    for i, html_file in enumerate(html_files, 1):
        print(f"[{i}/{len(html_files)}] Processing: {html_file.name}")
        
        generated = batch_generate_related(
            str(html_file),
            output_dir=output_dir,
            max_depth=max_depth,
            base_url=base_url,
            site_name=site_name,
            processed=processed,
            num_workers=num_workers
        )
        
        all_generated.extend(generated)
        print()
    
    return all_generated

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 2:
        print("=" * 70)
        print("🚀 BATCH GENERATE RELATED ARTICLES")
        print("=" * 70)
        print()
        print("Usage:")
        print("  python3 batch_generate_related_articles.py <html_file> [options]")
        print("  python3 batch_generate_related_articles.py --directory <dir> [options]")
        print()
        print("Options:")
        print("  --output-dir DIR       Output directory (default: output)")
        print("  --max-depth N          Maximum depth untuk recursive (default: 1)")
        print("  --base-url URL         Base URL (default: https://packaginginsights.b-cdn.net)")
        print("  --site-name NAME       Site name (default: Packaging Insights)")
        print("  --workers N            Number of parallel workers (default: 5)")
        print("  --directory DIR        Process all HTML files in directory")
        print()
        print("Example:")
        print("  # Generate related dari satu file")
        print("  python3 batch_generate_related_articles.py output/slot-gacor.html")
        print()
        print("  # Generate dengan recursive (depth 2)")
        print("  python3 batch_generate_related_articles.py output/slot-gacor.html --max-depth 2")
        print()
        print("  # Generate dari semua file di directory")
        print("  python3 batch_generate_related_articles.py --directory output")
        print()
        sys.exit(1)
    
    html_file = None
    directory = None
    output_dir = 'output'
    max_depth = 1
    base_url = 'https://packaginginsights.b-cdn.net'
    site_name = 'Packaging Insights'
    num_workers = 5
    
    # Parse arguments
    i = 1
    while i < len(sys.argv):
        if sys.argv[i] == '--directory' and i + 1 < len(sys.argv):
            directory = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--output-dir' and i + 1 < len(sys.argv):
            output_dir = sys.argv[i + 1]
            i += 2
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
        elif not html_file and not directory:
            html_file = sys.argv[i]
            i += 1
        else:
            i += 1
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    if directory:
        # Process all files in directory
        generated = batch_generate_from_directory(
            directory,
            output_dir=output_dir,
            max_depth=max_depth,
            base_url=base_url,
            site_name=site_name,
            num_workers=num_workers
        )
    elif html_file:
        # Process single file
        generated = batch_generate_related(
            html_file,
            output_dir=output_dir,
            max_depth=max_depth,
            base_url=base_url,
            site_name=site_name,
            num_workers=num_workers
        )
    else:
        print("❌ Harus specify html_file atau --directory")
        sys.exit(1)
    
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
        for file in generated[:10]:  # Show first 10
            print(f"   - {file}")
        if len(generated) > 10:
            print(f"   ... and {len(generated) - 10} more")
    print()
    print(f"Output directory: {output_dir}")
    print()

