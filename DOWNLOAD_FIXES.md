# MCP Server Download Fixes

## Summary of Changes

We've fixed the MCP server download functionality by:

1. Updating the `getDownloadUrl` function in `install.ts` to use the correct naming pattern for the server binaries:
   - Windows: `mcp-server-windows.exe`
   - macOS arm64: `mcp-server-macos-arm64`
   - macOS x64: `mcp-server-macos-x64`
   - Linux: `mcp-server-linux` (no architecture suffix)

2. Made the download URL dynamic in `bun.config.ts` by:
   - Reading the version from package.json
   - Setting environment variables correctly for the GitHub download URL

3. Verified the downloads are working correctly by:
   - Creating and running test scripts to download all platform binaries
   - Verifying the Linux binary executes and reports the correct version

## Verification

All binaries are now downloading successfully from the GitHub releases page:
- Windows binary (108MB)
- macOS ARM64 binary (56MB)
- macOS x64 binary (61MB)
- Linux binary (96MB)

The Linux binary was tested and correctly reports version `0.2.22`.

## Next Steps

- When a new version is released, make sure to verify that the binaries follow the same naming convention
- Consider adding automated tests for the download functionality
- Update documentation to reflect the correct naming conventions

## Notes for Contributors

When working with the MCP server downloads, remember:
1. The binary naming convention is important (`mcp-server-<platform>`)
2. The Linux binary does NOT include architecture in the filename
3. The download URL pattern is: `https://github.com/jacksteamdev/obsidian-mcp-tools/releases/download/${version}/mcp-server-<platform>`
