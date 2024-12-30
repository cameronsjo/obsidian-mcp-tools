import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ErrorCode,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { type } from "arktype";
import {
  buildTemplateArgumentsSchema,
  LocalRestAPI,
  PromptFrontmatterSchema,
  type PromptMetadata,
} from "shared";
import { logger } from "./logger";
import { makeRequest } from "./makeRequest";
import { formatMcpError } from "./utilities";
import { parseTemplateParameters } from "./parseTemplateParameters";

// TODO: make prompt folder location configurable
const VAULT_PROMPTS_NAME = "Prompts";
const VAULT_PROMPTS_PATH = `/vault/${VAULT_PROMPTS_NAME}/`;

export function setupObsidianPrompts(server: Server) {
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    try {
      const { files } = await makeRequest(
        LocalRestAPI.ApiVaultDirectoryResponse,
        VAULT_PROMPTS_PATH,
      );
      const prompts: PromptMetadata[] = (
        await Promise.all(
          files.map(async (filename) => {
            // Skip non-Markdown files
            if (!filename.endsWith(".md")) return [];

            // Retrieve frontmatter and content from vault file
            const file = await makeRequest(
              LocalRestAPI.ApiVaultFileResponse,
              VAULT_PROMPTS_PATH + filename,
              {
                headers: { Accept: LocalRestAPI.MIME_TYPE_OLRAPI_NOTE_JSON },
              },
            );

            // Skip files without the prompt template tag
            if (!file.tags.includes("mcp-tools-prompt")) {
              return [];
            }

            return {
              name: filename,
              description: file.frontmatter.description,
              arguments: parseTemplateParameters(file.content),
            };
          }),
        )
      ).flat();
      return { prompts };
    } catch (err) {
      const error = formatMcpError(err);
      logger.error("Error in ListPromptsRequestSchema handler", {
        error,
        message: error.message,
      });
      throw error;
    }
  });

  server.setRequestHandler(GetPromptRequestSchema, async ({ params }) => {
    try {
      // Get prompt content
      const { content: template, frontmatter } = await makeRequest(
        LocalRestAPI.ApiVaultFileResponse,
        VAULT_PROMPTS_PATH + params.name,
        {
          headers: { Accept: LocalRestAPI.MIME_TYPE_OLRAPI_NOTE_JSON },
        },
      );

      const { description } = PromptFrontmatterSchema.assert(frontmatter);
      const templateParams = parseTemplateParameters(template);
      const templateParamsSchema = buildTemplateArgumentsSchema(templateParams);
      const templateArgs = templateParamsSchema(params.arguments);
      if (templateArgs instanceof type.errors) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Invalid arguments: ${templateArgs.summary}`,
        );
      }

      const templateExecutionArgs: LocalRestAPI.ApiTemplateExecutionParamsType =
        {
          name: params.name,
          arguments: templateArgs,
        };

      // Process template through Templater plugin
      const { content } = await makeRequest(
        LocalRestAPI.ApiTemplateExecutionResponse,
        "/templates/execute",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(templateExecutionArgs),
        },
      );

      // Using unsafe assertion b/c the last element is always a string
      const withoutFrontmatter = content.split("---").at(-1)!.trim();

      return {
        messages: [
          {
            description,
            role: "user",
            content: {
              type: "text",
              text: withoutFrontmatter,
            },
          },
        ],
      };
    } catch (err) {
      const error = formatMcpError(err);
      logger.error("Error in GetPromptRequestSchema handler", {
        error,
        message: error.message,
      });
      throw error;
    }
  });
}
