# Health Check Resources

This feature provides health check and capabilities resources for the Obsidian MCP server.

## Resources

### health://status

Returns server health information including:

- **version**: Server version string
- **uptime**: Server uptime in seconds
- **connected**: Boolean indicating if Local REST API is accessible
- **scopes**: Array of granted OAuth-style permission scopes
- **features**: Object indicating availability of each feature
- **timestamp**: ISO 8601 timestamp of when status was generated

Example response:

```json
{
  "version": "0.2.27",
  "uptime": 1234,
  "connected": true,
  "scopes": ["admin:*"],
  "features": {
    "localRestApi": true,
    "smartConnections": true,
    "templater": true,
    "dispatchers": true,
    "fetch": true,
    "prompts": true
  },
  "timestamp": "2025-11-30T10:30:00.000Z"
}
```

### health://capabilities

Returns server capabilities including:

- **sdkVersion**: MCP SDK version (e.g., "1.23.0")
- **protocolVersion**: MCP protocol version
- **tools**: Array of registered tools with their descriptions and input schemas
- **prompts**: Array of registered prompts with their descriptions and arguments
- **resources**: Array of available resource URIs
- **serverVersion**: Server version string
- **timestamp**: ISO 8601 timestamp of when capabilities were generated

Example response:

```json
{
  "sdkVersion": "1.23.0",
  "protocolVersion": "2025-06-18",
  "tools": [
    {
      "name": "fetch",
      "description": "Reads and returns the content of any web page...",
      "inputSchema": {
        "type": "object",
        "properties": {
          "url": { "type": "string" },
          "maxLength": { "type": "number" }
        }
      }
    }
  ],
  "prompts": [
    {
      "name": "example.md",
      "description": "Example prompt",
      "arguments": []
    }
  ],
  "resources": [
    "health://status",
    "health://capabilities"
  ],
  "serverVersion": "0.2.27",
  "timestamp": "2025-11-30T10:30:00.000Z"
}
```

## Usage with MCP Clients

### Reading Resources

Use the standard MCP resource reading protocol:

```typescript
// List available resources
const resourcesResult = await session.request(
  { method: "resources/list" },
  ListResourcesRequestSchema
);

// Read health status
const statusResult = await session.request(
  {
    method: "resources/read",
    params: { uri: "health://status" }
  },
  ReadResourceRequestSchema
);

// Read capabilities
const capabilitiesResult = await session.request(
  {
    method: "resources/read",
    params: { uri: "health://capabilities" }
  },
  ReadResourceRequestSchema
);
```

## Implementation Details

### Architecture

- **types.ts**: TypeScript type definitions for health status and capabilities
- **services.ts**: Business logic for gathering health and capability information
- **index.ts**: Resource registration and request handlers

### Feature Detection

The health check automatically detects feature availability:

- **localRestApi**: Attempts to connect to Local REST API
- **smartConnections**: Available if Local REST API is connected
- **templater**: Available if Local REST API is connected
- **dispatchers**: Always available (no external dependencies)
- **fetch**: Always available (uses native fetch)
- **prompts**: Available if Local REST API is connected

### Scope Information

The health status includes the currently granted scopes from `OBSIDIAN_MCP_SCOPES` environment variable. This shows what operations are permitted based on the OAuth-style permission system.

### Uptime Tracking

Server uptime is calculated from a module-level constant `SERVER_START_TIME` that is set when the services module is first loaded.

## Security Considerations

- Health resources expose server configuration and capabilities
- No sensitive information (API keys, file contents) is included
- Scopes are shown but not scope validation tokens
- Connection status is revealed but not connection details

## Error Handling

All errors in resource handlers are:

1. Caught and formatted using `formatMcpError()`
2. Logged with structured logging including error details
3. Re-thrown to be handled by the MCP framework

## Future Enhancements

Potential additions:

- Resource usage metrics (memory, CPU)
- Error rate statistics
- Last error timestamp and message
- Plugin-specific health checks
- Websocket connection status (for future SSE transport)
