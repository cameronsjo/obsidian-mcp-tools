import {
  formatMcpError,
  makeRequest,
  parseTemplateParameters,
  type ToolRegistry,
} from "$/shared";
import { type } from "arktype";
import { buildTemplateArgumentsSchema, LocalRestAPI } from "shared";

export function registerTemplaterTools(tools: ToolRegistry) {
  tools.register(
    type({
      name: '"execute_template"',
      arguments: LocalRestAPI.ApiTemplateExecutionParams,
    }).describe("Execute a Templater template with the given arguments"),
    async ({ arguments: args }) => {
      // Get prompt content
      const data = await makeRequest(
        LocalRestAPI.ApiVaultFileResponse,
        `/vault/Prompts/${args.name}.md`,
        {
          headers: { Accept: LocalRestAPI.MIME_TYPE_OLRAPI_NOTE_JSON },
        },
      );

      // Validate prompt arguments
      const templateParameters = parseTemplateParameters(data.content);
      const validArgs = buildTemplateArgumentsSchema(templateParameters)(
        args.arguments,
      );
      if (validArgs instanceof type.errors) {
        throw formatMcpError(validArgs);
      }

      const templateExecutionArgs: LocalRestAPI.ApiTemplateExecutionParamsType =
        {
          name: args.name,
          arguments: validArgs,
        };

      // Process template through Templater plugin
      const response = await makeRequest(
        LocalRestAPI.ApiTemplateExecutionResponse,
        "/templates/execute",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(templateExecutionArgs),
        },
      );

      return {
        content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
      };
    },
  );
}
