import { logger, type ToolRegistry } from "$/shared";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { type } from "arktype";
import {
  getUrlValidationOptionsFromEnv,
  validateUrl,
} from "../../shared/validateUrl";
import { DEFAULT_USER_AGENT, FETCH_TIMEOUT_MS } from "./constants";
import { convertHtmlToMarkdown } from "./services/markdown";

export function registerFetchTool(tools: ToolRegistry, server: Server) {
  tools.register(
    type({
      name: '"fetch"',
      arguments: {
        url: "string",
        "maxLength?": type("number").describe("Limit response length."),
        "startIndex?": type("number").describe(
          "Supports paginated retrieval of content.",
        ),
        "raw?": type("boolean").describe(
          "Returns raw HTML content if raw=true.",
        ),
      },
    }).describe(
      "Reads and returns the content of any web page. Returns the content in Markdown format by default, or can return raw HTML if raw=true parameter is set. Supports pagination through maxLength and startIndex parameters. Note: For security, requests to localhost, private IPs, and internal networks are blocked by default.",
    ),
    async ({ arguments: args }) => {
      logger.info("Fetching URL", { url: args.url });

      // SSRF Protection: Validate URL before fetching
      const urlValidation = validateUrl(
        args.url,
        getUrlValidationOptionsFromEnv(),
      );
      if (!urlValidation.valid) {
        logger.warn("URL validation failed (SSRF protection)", {
          url: args.url,
          error: urlValidation.error,
        });
        throw new McpError(
          ErrorCode.InvalidParams,
          `URL validation failed: ${urlValidation.error}`,
        );
      }

      try {
        // Use AbortController for request timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        const response = await fetch(args.url, {
          headers: {
            "User-Agent": DEFAULT_USER_AGENT,
          },
          signal: controller.signal,
          redirect: "follow", // Allow redirects but URL was already validated
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to fetch ${args.url} - status code ${response.status}`,
          );
        }

        const contentType = response.headers.get("content-type") || "";
        const text = await response.text();

        const isHtml =
          text.toLowerCase().includes("<html") ||
          contentType.includes("text/html") ||
          !contentType;

        let content: string;
        let prefix = "";

        if (isHtml && !args.raw) {
          content = convertHtmlToMarkdown(text, args.url);
        } else {
          content = text;
          prefix = `Content type ${contentType} cannot be simplified to markdown, but here is the raw content:\n`;
        }

        const maxLength = args.maxLength || 5000;
        const startIndex = args.startIndex || 0;
        const totalLength = content.length;

        if (totalLength > maxLength) {
          content = content.substring(startIndex, startIndex + maxLength);
          content += `\n\n<error>Content truncated. Call the fetch tool with a startIndex of ${
            startIndex + maxLength
          } to get more content.</error>`;
        }

        logger.debug("URL fetched successfully", {
          url: args.url,
          contentLength: content.length,
        });

        return {
          content: [
            {
              type: "text",
              text: `${prefix}Contents of ${args.url}:\n${content}`,
            },
            {
              type: "text",
              text: `Pagination: ${JSON.stringify({
                totalLength,
                startIndex,
                endIndex: startIndex + content.length,
                hasMore: true,
              })}`,
            },
          ],
        };
      } catch (error) {
        logger.error("Failed to fetch URL", { url: args.url, error });
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to fetch ${args.url}: ${error}`,
        );
      }
    },
  );
}
