#!/bin/bash

VERSION="0.2.22"
BASE_URL="https://github.com/jacksteamdev/obsidian-mcp-tools/releases/download/$VERSION"
OUTPUT_DIR="/tmp/mcp-server-test"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Test downloading all binary types
echo "Testing all binary downloads for version $VERSION..."

# Windows
echo "Downloading Windows binary..."
curl -L "$BASE_URL/mcp-server-windows.exe" -o "$OUTPUT_DIR/mcp-server-windows.exe"

# macOS arm64
echo "Downloading macOS ARM64 binary..."
curl -L "$BASE_URL/mcp-server-macos-arm64" -o "$OUTPUT_DIR/mcp-server-macos-arm64"

# macOS x64
echo "Downloading macOS x64 binary..."
curl -L "$BASE_URL/mcp-server-macos-x64" -o "$OUTPUT_DIR/mcp-server-macos-x64"

# Linux
echo "Downloading Linux binary..."
curl -L "$BASE_URL/mcp-server-linux" -o "$OUTPUT_DIR/mcp-server-linux"

# Make Linux binary executable
chmod +x "$OUTPUT_DIR/mcp-server-linux"

# Check file sizes
echo "Checking file sizes..."
ls -lh "$OUTPUT_DIR/"

echo "Download test completed. Files saved to $OUTPUT_DIR/"
