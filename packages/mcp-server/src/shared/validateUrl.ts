/**
 * SSRF Protection for URL validation
 *
 * Validates URLs to prevent Server-Side Request Forgery attacks by:
 * - Restricting to safe protocols (http/https only)
 * - Blocking private/internal IP addresses
 * - Blocking localhost and loopback addresses
 * - Supporting configurable domain allowlists/blocklists
 */

/**
 * Private IP ranges that should be blocked (RFC1918 + RFC5735)
 */
const PRIVATE_IP_PATTERNS = [
  // Loopback (127.0.0.0/8)
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  // Private 10.0.0.0/8
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  // Private 172.16.0.0/12
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
  // Private 192.168.0.0/16
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  // Link-local 169.254.0.0/16
  /^169\.254\.\d{1,3}\.\d{1,3}$/,
  // Loopback IPv6
  /^::1$/,
  /^\[::1\]$/,
  // IPv4-mapped IPv6 loopback
  /^::ffff:127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
];

/**
 * Hostnames that should always be blocked
 */
const BLOCKED_HOSTNAMES = [
  "localhost",
  "localhost.localdomain",
  "local",
  // Common internal hostnames
  "internal",
  "intranet",
  "corp",
  "private",
  // Kubernetes/Docker internal
  "kubernetes.default",
  "kubernetes.default.svc",
  // Cloud metadata endpoints
  "metadata.google.internal",
  "169.254.169.254", // AWS/GCP/Azure metadata
];

/**
 * Allowed URL protocols
 */
const ALLOWED_PROTOCOLS = ["http:", "https:"];

export interface UrlValidationOptions {
  /**
   * Allow requests to private IP addresses (default: false)
   */
  allowPrivateIPs?: boolean;

  /**
   * Allow requests to localhost (default: false)
   */
  allowLocalhost?: boolean;

  /**
   * List of allowed domains (if set, only these domains are allowed)
   */
  allowedDomains?: string[];

  /**
   * List of blocked domains (checked before allowedDomains)
   */
  blockedDomains?: string[];

  /**
   * Maximum URL length (default: 2048)
   */
  maxUrlLength?: number;
}

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
  url?: URL;
}

/**
 * Checks if a hostname is a private/internal IP address
 */
function isPrivateIP(hostname: string): boolean {
  // Remove IPv6 brackets if present
  const cleanHostname = hostname.replace(/^\[|\]$/g, "");

  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(cleanHostname)) {
      return true;
    }
  }

  // Check for 0.0.0.0
  if (cleanHostname === "0.0.0.0") {
    return true;
  }

  return false;
}

/**
 * Checks if a hostname is localhost or a blocked internal hostname
 */
function isBlockedHostname(hostname: string): boolean {
  const lowerHostname = hostname.toLowerCase();

  // Check exact matches
  if (BLOCKED_HOSTNAMES.includes(lowerHostname)) {
    return true;
  }

  // Check if hostname ends with a blocked suffix
  for (const blocked of BLOCKED_HOSTNAMES) {
    if (lowerHostname.endsWith(`.${blocked}`)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a domain matches a pattern (supports wildcards)
 * e.g., "*.example.com" matches "sub.example.com"
 */
function domainMatches(hostname: string, pattern: string): boolean {
  const lowerHostname = hostname.toLowerCase();
  const lowerPattern = pattern.toLowerCase();

  if (lowerPattern.startsWith("*.")) {
    const suffix = lowerPattern.slice(1); // Keep the dot: ".example.com"
    return (
      lowerHostname.endsWith(suffix) ||
      lowerHostname === lowerPattern.slice(2) // exact match without wildcard
    );
  }

  return lowerHostname === lowerPattern;
}

/**
 * Validates a URL for SSRF protection
 *
 * @param urlString - The URL string to validate
 * @param options - Validation options
 * @returns Validation result with parsed URL if valid
 */
export function validateUrl(
  urlString: string,
  options: UrlValidationOptions = {},
): UrlValidationResult {
  const {
    allowPrivateIPs = false,
    allowLocalhost = false,
    allowedDomains,
    blockedDomains,
    maxUrlLength = 2048,
  } = options;

  // Check URL length
  if (urlString.length > maxUrlLength) {
    return {
      valid: false,
      error: `URL exceeds maximum length of ${maxUrlLength} characters`,
    };
  }

  // Parse URL
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return {
      valid: false,
      error: "Invalid URL format",
    };
  }

  // Check protocol
  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
    return {
      valid: false,
      error: `Protocol "${url.protocol}" is not allowed. Only http: and https: are permitted`,
    };
  }

  const hostname = url.hostname;

  // Check for localhost (unless explicitly allowed)
  if (!allowLocalhost && isBlockedHostname(hostname)) {
    return {
      valid: false,
      error: `Hostname "${hostname}" is blocked (localhost/internal hostname)`,
    };
  }

  // Check for private IPs (unless explicitly allowed)
  if (!allowPrivateIPs && isPrivateIP(hostname)) {
    return {
      valid: false,
      error: `Private IP addresses are not allowed: ${hostname}`,
    };
  }

  // Check blocked domains
  if (blockedDomains && blockedDomains.length > 0) {
    for (const blocked of blockedDomains) {
      if (domainMatches(hostname, blocked)) {
        return {
          valid: false,
          error: `Domain "${hostname}" is blocked`,
        };
      }
    }
  }

  // Check allowed domains (if allowlist is set)
  if (allowedDomains && allowedDomains.length > 0) {
    const isAllowed = allowedDomains.some((allowed) =>
      domainMatches(hostname, allowed),
    );
    if (!isAllowed) {
      return {
        valid: false,
        error: `Domain "${hostname}" is not in the allowlist`,
      };
    }
  }

  return {
    valid: true,
    url,
  };
}

/**
 * Get SSRF validation options from environment variables
 *
 * Environment variables:
 * - FETCH_ALLOW_PRIVATE_IPS: "true" to allow private IPs
 * - FETCH_ALLOW_LOCALHOST: "true" to allow localhost
 * - FETCH_ALLOWED_DOMAINS: Comma-separated list of allowed domains
 * - FETCH_BLOCKED_DOMAINS: Comma-separated list of blocked domains
 */
export function getUrlValidationOptionsFromEnv(): UrlValidationOptions {
  const parseList = (value: string | undefined): string[] | undefined => {
    if (!value) return undefined;
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  };

  return {
    allowPrivateIPs: process.env.FETCH_ALLOW_PRIVATE_IPS === "true",
    allowLocalhost: process.env.FETCH_ALLOW_LOCALHOST === "true",
    allowedDomains: parseList(process.env.FETCH_ALLOWED_DOMAINS),
    blockedDomains: parseList(process.env.FETCH_BLOCKED_DOMAINS),
  };
}
