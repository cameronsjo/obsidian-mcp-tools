import { logger, type ToolRegistry, ToolRegistryClass } from "$/shared";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setup as setupFetchTools } from "./features/fetch/index.js";
import { setupObsidianPrompts } from "./obsidian-prompts.js";
import { setupObsidianTools } from "./obsidian-tools.js";

export class ObsidianMcpServer {
  private server: Server;
  private tools: ToolRegistry;

  constructor() {
    this.server = new Server(
      {
        name: "obsidian-mcp-server",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
        },
      },
    );

    this.tools = new ToolRegistryClass();

    this.setupHandlers();

    // Error handling
    this.server.onerror = (error) => {
      logger.error("Server error", { error });
      console.error("[MCP Error]", error);
    };
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers() {
    setupObsidianPrompts(this.server);
    setupObsidianTools(this.tools, this.server);
    setupFetchTools(this.tools, this.server);
  }

  async run() {
    logger.debug("Starting server...");
    const transport = new StdioServerTransport();
    try {
      await this.server.connect(transport);
      logger.debug("Server started successfully");
      console.error("Obsidian MCP server running on stdio");
    } catch (err) {
      logger.fatal("Failed to start server", {
        error: err instanceof Error ? err.message : String(err),
      });
      process.exit(1);
    }
  }
}
