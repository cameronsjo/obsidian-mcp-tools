# MCP Tools for Obsidian - Development Tasks
# Run `just` to see available commands

# Default recipe: show help
default:
    @just --list

# Install all dependencies
install:
    bun install

# Run development mode (watch all packages)
dev:
    bun run dev

# Type check all packages
check:
    bun run check

# Run all tests
test:
    bun test

# Run tests for a specific package
test-pkg pkg:
    bun --filter {{pkg}} test

# Run MCP server tests only
test-server:
    cd packages/mcp-server && bun test

# Build all packages for production
build:
    bun run release

# Build plugin only
build-plugin:
    bun --filter obsidian-plugin build

# Build MCP server only
build-server:
    bun --filter mcp-server build

# Create release artifacts (binaries + zip)
release:
    bun run release && bun run zip

# Bump version (patch, minor, or major)
version bump:
    bun run version {{bump}}

# Link plugin to a test vault
link:
    bun --filter obsidian-plugin link

# Run MCP inspector for debugging
inspector:
    bun --filter mcp-server inspector

# Clean build artifacts
clean:
    rm -rf packages/*/dist
    rm -rf packages/obsidian-plugin/releases
    rm -f main.js styles.css

# Format code
fmt:
    bun x prettier --write "packages/**/*.{ts,svelte,json}"

# Lint code
lint:
    bun run check

# Run all quality checks (lint + test)
ci: check test

# Setup development environment
setup:
    bun install
    @echo "Development environment ready!"
    @echo "Run 'just dev' to start development mode"
    @echo "Run 'just link' to link plugin to a test vault"
