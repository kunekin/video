#!/usr/bin/env python3
"""
Script untuk update file HTML yang sudah ada agar menggunakan absolute URL untuk S3
Mengubah relative links menjadi absolute links dengan base_url
"""

import os
import re
import sys
from pathlib import Path
from bs4 import BeautifulSoup

def update_html_for_s3(html_file, base_url, old_base_url=None, output_file=None):
    """
    Update HTML file untuk menggunakan absolute URL dengan base_url
    
    Args:
        html_file: Path ke file HTML
        base_url: Base URL untuk S3/CloudFront (e.g., https://bucket.s3.amazonaws.com)
        old_base_url: Old base URL yang akan di-replace (e.g., https://packaginginsights.b-cdn.net)
        output_file: Output file (default: overwrite original)
    """
    if not os.path.exists(html_file):
        print(f"❌ File tidak ditemukan: {html_file}")
        return False
    
    # Read HTML
    with open(html_file, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    soup = BeautifulSoup(html_content, 'html.parser')
    changes_made = 0
    
    # Update semua <a> tags dengan href
    for link in soup.find_all('a', href=True):
        href = link['href']
        original_href = href
        
        # Replace old base_url jika ada
        if old_base_url and old_base_url in href:
            href = href.replace(old_base_url, base_url)
            link['href'] = href
            changes_made += 1
            print(f"   ✅ Updated: {original_href} → {href}")
            continue
        
        # Skip jika sudah ada base_url baru di href
        if base_url in href:
            continue
        
        # Skip jika sudah absolute URL (tapi bukan old_base_url)
        if href.startswith('http://') or href.startswith('https://'):
            continue
        
        # Skip jika bukan file HTML
        if not href.endswith('.html'):
            continue
        
        # Update ke absolute URL
        if href.startswith('/'):
            # Absolute path dari root
            new_href = f"{base_url}{href}"
        else:
            # Relative path - assume di /articles/
            new_href = f"{base_url}/articles/{href}"
        
        link['href'] = new_href
        changes_made += 1
        print(f"   ✅ Updated: {original_href} → {new_href}")
    
    # Update canonical URL jika ada
    canonical = soup.find('link', {'rel': 'canonical'})
    if canonical and canonical.get('href'):
        href = canonical['href']
        original_href = href
        
        # Replace old base_url jika ada
        if old_base_url and old_base_url in href:
            href = href.replace(old_base_url, base_url)
            canonical['href'] = href
            changes_made += 1
            print(f"   ✅ Updated canonical: {original_href} → {href}")
        elif not href.startswith('http'):
            if href.startswith('/'):
                canonical['href'] = f"{base_url}{href}"
            else:
                canonical['href'] = f"{base_url}/articles/{href}"
            changes_made += 1
            print(f"   ✅ Updated canonical: {original_href} → {canonical['href']}")
    
    # Update OG URL jika ada
    og_url = soup.find('meta', {'property': 'og:url'})
    if og_url and og_url.get('content'):
        content = og_url['content']
        original_content = content
        
        # Replace old base_url jika ada
        if old_base_url and old_base_url in content:
            content = content.replace(old_base_url, base_url)
            og_url['content'] = content
            changes_made += 1
            print(f"   ✅ Updated OG URL: {original_content} → {content}")
        elif not content.startswith('http'):
            if content.startswith('/'):
                og_url['content'] = f"{base_url}{content}"
            else:
                og_url['content'] = f"{base_url}/articles/{content}"
            changes_made += 1
            print(f"   ✅ Updated OG URL: {original_content} → {og_url['content']}")
    
    # Update OG Image jika ada
    og_image = soup.find('meta', {'property': 'og:image'})
    if og_image and og_image.get('content'):
        content = og_image['content']
        original_content = content
        
        # Replace old base_url jika ada
        if old_base_url and old_base_url in content:
            content = content.replace(old_base_url, base_url)
            og_image['content'] = content
            changes_made += 1
            print(f"   ✅ Updated OG Image: {original_content} → {content}")
        elif content and not content.startswith('http') and not content.startswith('//'):
            if content.startswith('/'):
                og_image['content'] = f"{base_url}{content}"
            else:
                og_image['content'] = f"{base_url}/{content}"
            changes_made += 1
            print(f"   ✅ Updated OG Image: {original_content} → {og_image['content']}")
    
    # Update JSON-LD structured data jika ada
    json_ld_scripts = soup.find_all('script', {'type': 'application/ld+json'})
    for script in json_ld_scripts:
        if old_base_url and old_base_url in script.string:
            original_string = script.string
            script.string = script.string.replace(old_base_url, base_url)
            changes_made += 1
            print(f"   ✅ Updated JSON-LD structured data")
    
    # Determine output file
    if output_file is None:
        output_file = html_file
    
    # Write updated HTML
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(str(soup))
    
    if changes_made > 0:
        print(f"✅ Updated {html_file}: {changes_made} changes made")
        return True
    else:
        print(f"ℹ️  No changes needed for {html_file}")
        return False

def batch_update_directory(directory, base_url, old_base_url=None, output_dir=None):
    """
    Batch update semua HTML files di directory
    
    Args:
        directory: Directory yang berisi HTML files
        base_url: Base URL untuk S3/CloudFront
        old_base_url: Old base URL yang akan di-replace
        output_dir: Output directory (default: overwrite original)
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
    print("🔄 BATCH UPDATE HTML FILES UNTUK S3")
    print("=" * 70)
    print()
    print(f"Directory: {directory}")
    print(f"Base URL: {base_url}")
    print(f"Found {len(html_files)} HTML files")
    print()
    
    updated_files = []
    
    for i, html_file in enumerate(html_files, 1):
        print(f"[{i}/{len(html_files)}] Processing: {html_file.name}")
        
        if output_dir:
            output_file = Path(output_dir) / html_file.name
            os.makedirs(output_dir, exist_ok=True)
        else:
            output_file = None
        
        if update_html_for_s3(str(html_file), base_url, old_base_url, str(output_file) if output_file else None):
            updated_files.append(str(output_file) if output_file else str(html_file))
        print()
    
    return updated_files

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("=" * 70)
        print("🔄 UPDATE HTML FILES UNTUK S3")
        print("=" * 70)
        print()
        print("Usage:")
        print("  python3 update_html_for_s3.py <html_file> <base_url> [old_base_url] [output_file]")
        print("  python3 update_html_for_s3.py --directory <dir> <base_url> [old_base_url] [output_dir]")
        print()
        print("Examples:")
        print("  # Update single file (replace old URL)")
        print("  python3 update_html_for_s3.py output/article.html \\")
        print("    https://bucket.s3.amazonaws.com \\")
        print("    https://packaginginsights.b-cdn.net")
        print()
        print("  # Update single file dengan output file baru")
        print("  python3 update_html_for_s3.py output/article.html \\")
        print("    https://bucket.s3.amazonaws.com \\")
        print("    https://packaginginsights.b-cdn.net \\")
        print("    output/article-s3.html")
        print()
        print("  # Batch update semua file di directory")
        print("  python3 update_html_for_s3.py --directory output \\")
        print("    https://bucket.s3.amazonaws.com \\")
        print("    https://packaginginsights.b-cdn.net")
        print()
        print("  # Batch update dengan output directory baru")
        print("  python3 update_html_for_s3.py --directory output \\")
        print("    https://bucket.s3.amazonaws.com \\")
        print("    https://packaginginsights.b-cdn.net \\")
        print("    output-s3")
        print()
        print("Base URL examples:")
        print("  - Direct S3: https://bucket-name.s3.us-east-1.amazonaws.com")
        print("  - CloudFront: https://d1234567890.cloudfront.net")
        print()
        sys.exit(1)
    
    base_url = None
    old_base_url = None
    html_file = None
    directory = None
    output_file = None
    output_dir = None
    
    # Parse arguments
    i = 1
    while i < len(sys.argv):
        if sys.argv[i] == '--directory' and i + 1 < len(sys.argv):
            directory = sys.argv[i + 1]
            i += 2
        elif not base_url and not html_file and not directory:
            if sys.argv[i].endswith('.html'):
                html_file = sys.argv[i]
            elif not base_url:
                base_url = sys.argv[i]
            i += 1
        elif base_url is None:
            base_url = sys.argv[i]
            i += 1
        elif old_base_url is None and (sys.argv[i].startswith('http://') or sys.argv[i].startswith('https://')):
            old_base_url = sys.argv[i]
            i += 1
        elif output_file is None and output_dir is None:
            if html_file:
                output_file = sys.argv[i]
            else:
                output_dir = sys.argv[i]
            i += 1
        else:
            i += 1
    
    if not base_url:
        print("❌ Base URL harus di-specify")
        sys.exit(1)
    
    if directory:
        # Batch update directory
        updated = batch_update_directory(directory, base_url, old_base_url, output_dir)
        print()
        print("=" * 70)
        print("✅ BATCH UPDATE COMPLETE")
        print("=" * 70)
        print(f"Total files updated: {len(updated)}")
    elif html_file:
        # Update single file
        update_html_for_s3(html_file, base_url, old_base_url, output_file)
    else:
        print("❌ Harus specify html_file atau --directory")
        sys.exit(1)

