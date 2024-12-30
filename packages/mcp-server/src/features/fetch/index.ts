import { logger, type ToolRegistry } from "$/shared";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { type } from "arktype";
import { DEFAULT_USER_AGENT } from "./constants";
import { convertHtmlToMarkdown } from "./services/markdown";

export function setup(tools: ToolRegistry, server: Server) {
  tools.register(
    type({
      name: '"fetch"',
      arguments: {
        url: "string",
        maxLength: "number?",
        startIndex: "number?",
        raw: "boolean?",
      },
    }).describe("Fetch a URL and extract its contents as markdown"),
    async ({ arguments: args }) => {
      logger.info("Fetching URL", { url: args.url });

      try {
        const response = await fetch(args.url, {
          headers: {
            "User-Agent": DEFAULT_USER_AGENT,
          },
        });

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

        if (content.length > maxLength) {
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
