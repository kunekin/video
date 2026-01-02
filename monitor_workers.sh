#!/bin/bash
# Script untuk monitoring worker dan memory usage
# Jalankan di terminal terpisah saat script Python berjalan

echo "🔍 Monitoring Workers dan Memory Usage"
echo "======================================"
echo ""

# Cari PID proses Python yang sedang berjalan
PYTHON_PID=$(pgrep -f "batch_generate\|generate_article" | head -1)

if [ -z "$PYTHON_PID" ]; then
    echo "❌ Tidak ada proses Python yang ditemukan"
    echo "   Pastikan script batch_generate atau generate_article sedang berjalan"
    exit 1
fi

echo "📊 PID Process: $PYTHON_PID"
echo ""

# Function untuk menampilkan info
show_info() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⏰ $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    # Memory usage
    echo "💾 MEMORY USAGE:"
    ps -o pid,rss,vsz,pcpu,comm -p $PYTHON_PID 2>/dev/null | tail -1 | awk '{
        rss_mb = $2 / 1024
        vsz_mb = $3 / 1024
        printf "   RSS (Physical Memory): %.2f MB\n", rss_mb
        printf "   VSZ (Virtual Memory):  %.2f MB\n", vsz_mb
        printf "   CPU Usage:            %.1f%%\n", $4
    }'
    echo ""
    
    # Thread count (worker threads)
    echo "🧵 THREADS (Workers):"
    THREAD_COUNT=$(ps -M -p $PYTHON_PID 2>/dev/null | wc -l | tr -d ' ')
    ACTIVE_THREADS=$((THREAD_COUNT - 1))  # Subtract header line
    echo "   Total Threads: $ACTIVE_THREADS"
    echo ""
    
    # System memory
    echo "🖥️  SYSTEM MEMORY:"
    vm_stat | perl -ne '/page size of (\d+)/ and $size=$1; /Pages\s+([^:]+)[^\d]+(\d+)/ and printf("   %-16s % 16.2f Mi\n", "$1:", $2 * $size / 1048576);'
    echo ""
}

# Loop monitoring
if [ "$1" == "--watch" ] || [ "$1" == "-w" ]; then
    # Continuous monitoring
    while true; do
        clear
        show_info
        echo "Press Ctrl+C to stop monitoring"
        sleep 2
    done
else
    # Single snapshot
    show_info
    echo ""
    echo "💡 Tip: Jalankan dengan --watch untuk monitoring kontinyu:"
    echo "   ./monitor_workers.sh --watch"
fi

