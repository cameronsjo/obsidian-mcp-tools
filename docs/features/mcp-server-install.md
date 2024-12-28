# MCP Server Installation Feature Requirements

## Overview

This feature enables users to install and manage the MCP server executable through the Obsidian plugin settings interface. The system handles the download of platform-specific binaries, Claude Desktop configuration, and provides clear user feedback throughout the process.

## Implementation Location

The installation feature is implemented in the Obsidian plugin package under `src/features/mcp-server-install`.

## Installation Flow

1. User Prerequisites:

   - Claude Desktop installed
   - Local REST API plugin installed and configured

2. Installation Steps:
   - User navigates to plugin settings
   - User enters OBSIDIAN_API_KEY (if not previously stored)
   - User initiates installation via button
   - Plugin downloads appropriate binary
   - Plugin updates Claude config file
   - Plugin confirms successful installation

## Settings UI Requirements

1. Display Elements:

   - Installation status indicator
   - API key input field (if not configured)
   - Install/Update/Uninstall buttons
   - Links to:
     - Downloaded executable location
     - Log folder location
     - GitHub repository
     - Claude Desktop download page (if needed)

2. Status States:
   - Not Installed
   - Installing
   - Installed
   - Update Available

## Download Management

1. Binary Source:

   - GitHub latest release
   - Platform-specific naming conventions
   - Version number included in filename (e.g., mcp-server-1.2.3)

2. Installation Locations:
   - Binary: {vault}/.obsidian/plugins/{plugin-id}/bin/
   - Logs:
     - macOS: ~/Library/Logs/obsidian-mcp-tools
     - Windows: %APPDATA%\obsidian-mcp-tools\logs
     - Linux: (platform-specific path)

## Claude Configuration

1. Config File:
   - Location: ~/Library/Application Support/Claude/claude_desktop_config.json
   - Create base structure if missing: { "mcpServers": {} }
   - Add/update only our config entry:
     ```json
     {
       "mcpServers": {
         "obsidian-mcp-tools": {
           "command": "(absolute path to executable)",
           "env": {
             "OBSIDIAN_API_KEY": "(stored api key)"
           }
         }
       }
     }
     ```

## Version Management

1. Unified Version Approach:
   - Plugin and server share same version number
   - Version stored in plugin manifest
   - Server binary named with version (e.g., mcp-server-1.2.3)
   - Server provides version via `--version` flag
   - Version checked during plugin initialization

## User Education

1. Documentation Requirements:
   - README.md must explain:
     - Binary download and installation process
     - GitHub source code location
     - Claude config file modifications
     - Log file locations and purpose
   - Settings page must link to full documentation

## Error Handling

1. Installation Errors:

   - Claude Desktop not installed
   - Download failures
   - Permission issues
   - Version mismatch

2. User Feedback:
   - Use Obsidian Notice API for progress/status
   - Clear error messages with next steps
   - Links to troubleshooting resources

## Uninstall Process

1. Cleanup Actions:
   - Remove executable
   - Remove our entry from Claude config
   - Clear stored plugin data
