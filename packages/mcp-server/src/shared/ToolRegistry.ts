import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ErrorCode,
  McpError,
  type Result,
} from "@modelcontextprotocol/sdk/types.js";
import { type, type Type } from "arktype";
import { formatMcpError } from "./formatMcpError.js";
import { logger } from "./logger.js";

interface HandlerContext {
  server: Server;
}

const textResult = type({
  type: '"text"',
  text: "string",
});
const imageResult = type({
  type: '"image"',
  data: "string.base64",
  mimeType: "string",
});
const resultSchema = type({
  content: textResult.or(imageResult).array(),
  "isError?": "boolean",
});

type ResultSchema = typeof resultSchema.infer;

/**
 * The ToolRegistry class represents a set of tools that can be used by
 * the server. It is a map of request schemas to request handlers
 * that provides a list of available tools and a method to handle requests.
 */
class _ToolRegistry<
  TSchema extends Type<
    {
      name: string;
      arguments?: Record<string, unknown>;
    },
    {}
  >,
  THandler extends (
    request: TSchema["infer"],
    context: HandlerContext,
  ) => Promise<Result>,
> extends Map<TSchema, THandler> {
  private enabled = new Set<TSchema>();

  register<
    Schema extends TSchema,
    Handler extends (
      request: Schema["infer"],
      context: HandlerContext,
    ) => ResultSchema | Promise<ResultSchema>,
  >(schema: Schema, handler: Handler) {
    if (this.has(schema)) {
      throw new Error(`Tool already registered: ${schema.get("name")}`);
    }
    this.enable(schema);
    return super.set(
      schema as unknown as TSchema,
      handler as unknown as THandler,
    );
  }

  enable = <Schema extends TSchema>(schema: Schema) => {
    this.enabled.add(schema);
    return this;
  };

  disable = <Schema extends TSchema>(schema: Schema) => {
    this.enabled.delete(schema);
    return this;
  };

  list = () => {
    return {
      tools: Array.from(this.enabled.values()).map((schema) => {
        return {
          // @ts-expect-error We know the const property is present for a string
          name: schema.get("name").toJsonSchema().const,
          description: schema.description,
          inputSchema: schema.get("arguments").toJsonSchema(),
        };
      }),
    };
  };

  dispatch = async <Schema extends TSchema>(
    params: Schema["infer"],
    context: HandlerContext,
  ) => {
    try {
      for (const [schema, handler] of this.entries()) {
        if (schema.get("name").allows(params.name) && schema.assert(params)) {
          // return await to handle the error here
          return await handler(params, context);
        }
      }
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Unknown tool: ${params.name}`,
      );
    } catch (error) {
      const formattedError = formatMcpError(error);
      logger.error(`Error handling ${params.name}`, {
        ...formattedError,
        error,
        params,
      });
      throw formattedError;
    }
  };
}

const tools = new _ToolRegistry();
export type ToolRegistry = typeof tools;
export default tools;
