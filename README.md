# Obsidian MCP Tools

Obsidian MCP Tools enhances your Obsidian experience by providing a Model Context Protocol (MCP) server that enables advanced features like semantic search, template execution, and AI-powered tools.

## Features

- **Semantic Search**: Leverage advanced search capabilities to find relevant notes based on meaning, not just keywords
- **Template Execution**: Run templates with dynamic parameters and AI-powered content generation
- **AI Integration**: Connect with Claude Desktop for enhanced functionality

## Prerequisites

### Required

- [Obsidian](https://obsidian.md/) v1.0.0 or higher
- [Claude Desktop](https://claude.ai/desktop) installed and configured
- [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin installed and configured with an API key

### Recommended

- [Templater](https://silentvoid13.github.io/Templater/) plugin for enhanced template functionality
- [Smart Connections](https://smartconnections.app/) plugin for improved semantic search capabilities

## Installation

1. Install the plugin from Obsidian's Community Plugins
2. Enable the plugin in Obsidian settings
3. Open the plugin settings
4. Click "Install Server" to download and configure the MCP server

The plugin will:
- Download the appropriate MCP server binary for your platform
- Configure Claude Desktop to use the server
- Set up necessary permissions and paths

### Installation Locations

- **Server Binary**: {vault}/.obsidian/plugins/obsidian-mcp-tools/bin/
- **Log Files**:
  - macOS: ~/Library/Logs/obsidian-mcp-tools
  - Windows: %APPDATA%\obsidian-mcp-tools\logs
  - Linux: ~/.local/share/obsidian-mcp-tools/logs

## Configuration

The plugin automatically:
1. Uses your Local REST API plugin's API key
2. Configures Claude Desktop to use the MCP server
3. Sets up appropriate paths and permissions

No manual configuration is required beyond installing prerequisites.

## Troubleshooting

If you encounter issues:

1. Check the plugin settings to verify:
   - All required plugins are installed
   - The server is properly installed
   - Claude Desktop is configured

2. Review the logs:
   - Open plugin settings
   - Click "Open Logs" under Resources
   - Look for any error messages or warnings

3. Common Issues:
   - **Server won't start**: Ensure Claude Desktop is running
   - **Connection errors**: Verify Local REST API plugin is configured
   - **Permission errors**: Try reinstalling the server

## Development

This project uses a bun workspace structure:

```
packages/
├── mcp-server/        # Server implementation
├── obsidian-plugin/   # Obsidian plugin
└── shared/           # Shared utilities and types
```

### Building

1. Install dependencies:
   ```bash
   bun install
   ```

2. Build all packages:
   ```bash
   bun run build
   ```

3. For development:
   ```bash
   bun run dev
   ```

### Requirements

- [bun](https://bun.sh/) v1.0.0 or higher
- TypeScript 5.0+

## License

[MIT License](LICENSE)
