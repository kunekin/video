#!/usr/bin/env python3
"""
Script untuk monitoring worker dan memory usage
Jalankan di terminal terpisah saat script batch_generate sedang berjalan
"""

import os
import sys
import time
import subprocess
import psutil

def find_python_processes():
    """Cari proses Python yang relevan"""
    processes = []
    for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'memory_info', 'cpu_percent', 'num_threads']):
        try:
            if proc.info['name'] and 'python' in proc.info['name'].lower():
                cmdline = ' '.join(proc.info['cmdline']) if proc.info['cmdline'] else ''
                if 'batch_generate' in cmdline or 'generate_article' in cmdline:
                    processes.append(proc)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return processes

def format_bytes(bytes_val):
    """Format bytes ke MB/GB"""
    mb = bytes_val / (1024 * 1024)
    if mb > 1024:
        return f"{mb / 1024:.2f} GB"
    return f"{mb:.2f} MB"

def show_process_info(proc):
    """Tampilkan info proses"""
    try:
        info = proc.as_dict(['pid', 'name', 'cmdline', 'memory_info', 'cpu_percent', 'num_threads', 'create_time'])
        mem = info['memory_info']
        
        print("=" * 70)
        print(f"📊 Process ID: {info['pid']}")
        print(f"📝 Command: {' '.join(info['cmdline'][:3])}...")
        print()
        print("💾 MEMORY USAGE:")
        print(f"   RSS (Physical Memory): {format_bytes(mem.rss)}")
        print(f"   VMS (Virtual Memory):  {format_bytes(mem.vms)}")
        print(f"   CPU Usage:            {info['cpu_percent']:.1f}%")
        print()
        print("🧵 THREADS (Workers):")
        print(f"   Total Threads: {info['num_threads']}")
        print()
        
        # System memory
        print("🖥️  SYSTEM MEMORY:")
        sys_mem = psutil.virtual_memory()
        print(f"   Total:     {format_bytes(sys_mem.total)}")
        print(f"   Available: {format_bytes(sys_mem.available)}")
        print(f"   Used:      {format_bytes(sys_mem.used)} ({sys_mem.percent}%)")
        print(f"   Free:      {format_bytes(sys_mem.free)}")
        print()
        
        return True
    except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
        print(f"❌ Error: {e}")
        return False

def main():
    if len(sys.argv) > 1 and sys.argv[1] in ['--watch', '-w']:
        # Continuous monitoring
        print("🔍 Monitoring Workers dan Memory Usage (Press Ctrl+C to stop)")
        print("=" * 70)
        print()
        
        while True:
            processes = find_python_processes()
            if processes:
                for proc in processes:
                    show_process_info(proc)
                print("⏰ Updated:", time.strftime('%Y-%m-%d %H:%M:%S'))
                print()
                print("Press Ctrl+C to stop monitoring")
                time.sleep(2)
                # Clear screen (works on most terminals)
                os.system('clear' if os.name != 'nt' else 'cls')
            else:
                print("❌ Tidak ada proses Python yang ditemukan")
                print("   Pastikan script batch_generate atau generate_article sedang berjalan")
                time.sleep(2)
    else:
        # Single snapshot
        processes = find_python_processes()
        if processes:
            for proc in processes:
                show_process_info(proc)
            print()
            print("💡 Tip: Jalankan dengan --watch untuk monitoring kontinyu:")
            print("   python3 monitor_workers.py --watch")
        else:
            print("❌ Tidak ada proses Python yang ditemukan")
            print("   Pastikan script batch_generate atau generate_article sedang berjalan")
            sys.exit(1)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n✅ Monitoring stopped")
        sys.exit(0)

