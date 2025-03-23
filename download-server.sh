#!/bin/bash

# Download MCP server for Linux
VERSION="0.2.22"
DOWNLOAD_URL="https://github.com/jacksteamdev/obsidian-mcp-tools/releases/download/$VERSION/mcp-server-linux"
OUTPUT_PATH="/tmp/mcp-server-correct"

echo "Downloading MCP server version $VERSION..."
curl -L "$DOWNLOAD_URL" -o "$OUTPUT_PATH"
chmod +x "$OUTPUT_PATH"

# Check file size to make sure it's a valid binary
SIZE=$(stat -c%s "$OUTPUT_PATH")
echo "Downloaded file size: $SIZE bytes"

if [ "$SIZE" -lt 1000 ]; then
  echo "ERROR: Downloaded file is too small, likely not a valid binary"
  echo "Content of the file:"
  cat "$OUTPUT_PATH"
  exit 1
else
  echo "Successfully downloaded MCP server to $OUTPUT_PATH"
  echo "Run it with: $OUTPUT_PATH"
fi
