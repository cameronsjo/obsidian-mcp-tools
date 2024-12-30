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

## Security

### Binary Verification

The MCP server binaries are published with [GitHub's artifact attestations](https://docs.github.com/en/actions/security-guides/using-artifact-attestations-and-reusable-workflows-to-achieve-slsa-v1-build-level-3), which provide cryptographic proof of where and how the binaries were built. This helps ensure the integrity and provenance of the binaries you download.

To verify a binary:

1. Install the GitHub CLI: https://cli.github.com/
2. Download the binary from the releases page
3. Run the verification command:
   ```bash
   gh attestation verify PATH/TO/DOWNLOADED/BINARY -R jacksteamdev/obsidian-mcp-tools
   ```

The command will show you:
- The GitHub repository that built the binary
- The workflow that created it
- The commit SHA and other build details

This verification provides SLSA Level 2 assurance that the binary was built from the source code in this repository using GitHub Actions.

## License

[MIT License](LICENSE)
