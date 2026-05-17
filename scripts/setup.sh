#!/bin/bash
# ns-agent Setup Script
# Jalankan: bash scripts/setup.sh

echo "=== ns-agent Setup ==="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js tidak terinstall. Install dulu dari https://nodejs.org"
    exit 1
fi

echo "[OK] Node.js: $(node --version)"
echo "[OK] npm: $(npm --version)"
echo ""

# Install dependencies
echo "[1/3] Installing dependencies..."
npm install
echo ""

# Setup environment
echo "[2/3] Setting up environment..."
if [ ! -f .env ]; then
    echo "File .env belum ada. Silakan buat manual dari docs/environment-setup.md"
    echo "  cp docs/environment-setup.md .env"
    echo "  lalu edit .env sesuai kebutuhan"
else
    echo "[OK] .env sudah ada"
fi
echo ""

# Reorganize plugins
echo "[3/3] Reorganizing plugins..."
read -p "Pindahkan plugin ke folder kategori? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx tsx scripts/reorganize-plugins.ts
else
    echo "Skip reorganisasi. Jalankan manual: npx tsx scripts/reorganize-plugins.ts"
fi
echo ""

echo "=== Setup Selesai ==="
echo ""
echo "Untuk menjalankan bot:"
echo "  npm run dev    # Development mode"
echo "  npm start      # Production mode"
echo ""
