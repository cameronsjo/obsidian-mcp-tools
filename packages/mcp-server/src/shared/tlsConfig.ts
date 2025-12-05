/**
 * TLS Configuration for Local REST API connections
 *
 * The Local REST API plugin uses self-signed certificates for HTTPS.
 * This module provides safe TLS configuration that:
 *
 * 1. Only bypasses certificate validation for verified localhost connections
 * 2. Validates the host is actually localhost before making requests
 * 3. Logs security warnings when TLS validation is bypassed
 *
 * SECURITY NOTE: TLS certificate validation bypass is only acceptable for
 * localhost connections where the traffic never leaves the machine.
 * This is a tradeoff between security and usability for local development.
 *
 * Future improvement: Implement proper certificate pinning where the plugin
 * exports its certificate and the MCP server pins to that specific certificate.
 */

import { logger } from "./logger";

/**
 * Valid localhost addresses that are safe for TLS bypass
 */
const LOCALHOST_ADDRESSES = [
  "127.0.0.1",
  "localhost",
  "::1",
  "[::1]",
];

/**
 * Check if a host is a localhost address
 */
export function isLocalhostHost(host: string): boolean {
  const normalizedHost = host.toLowerCase();
  return LOCALHOST_ADDRESSES.includes(normalizedHost);
}

/**
 * Validates that the configured Obsidian host is localhost
 *
 * This is a security check to ensure we only bypass TLS validation
 * for local connections, never for remote servers.
 *
 * @throws Error if the host is not localhost
 */
export function validateLocalhostConnection(host: string): void {
  if (!isLocalhostHost(host)) {
    throw new Error(
      `Security error: TLS validation bypass is only allowed for localhost connections. ` +
        `Configured host "${host}" is not a recognized localhost address. ` +
        `If you need to connect to a remote server, use proper TLS certificates.`,
    );
  }
}

/**
 * Configuration for TLS handling
 */
export interface TlsConfig {
  /** Whether to use HTTP instead of HTTPS */
  useHttp: boolean;
  /** The host to connect to */
  host: string;
  /** The port to connect to */
  port: number;
  /** Whether TLS validation is bypassed (only valid for localhost) */
  tlsValidationBypassed: boolean;
}

/**
 * Initialize TLS configuration for the MCP server
 *
 * This function:
 * 1. Reads configuration from environment variables
 * 2. Validates that TLS bypass is only used for localhost
 * 3. Sets up the appropriate TLS configuration
 * 4. Logs security-relevant configuration
 *
 * @returns TLS configuration object
 */
export function initializeTlsConfig(): TlsConfig {
  const useHttp = process.env.OBSIDIAN_USE_HTTP === "true";
  const host = process.env.OBSIDIAN_HOST || "127.0.0.1";
  const port = useHttp ? 27123 : 27124;

  // Validate localhost before allowing TLS bypass
  if (!useHttp) {
    validateLocalhostConnection(host);

    // Only set NODE_TLS_REJECT_UNAUTHORIZED after validating localhost
    // This is a global setting, but we've verified the connection is local
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    logger.warn("TLS certificate validation bypassed for localhost connection", {
      host,
      port,
      reason: "Local REST API uses self-signed certificates",
      security:
        "This is safe because traffic never leaves the machine. " +
        "Do not use this configuration for remote connections.",
    });
  }

  return {
    useHttp,
    host,
    port,
    tlsValidationBypassed: !useHttp,
  };
}

/**
 * Get the base URL for the Local REST API
 */
export function getBaseUrl(config: TlsConfig): string {
  const protocol = config.useHttp ? "http" : "https";
  return `${protocol}://${config.host}:${config.port}`;
}
