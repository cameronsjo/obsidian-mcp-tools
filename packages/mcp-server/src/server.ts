import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { logger } from "./logger.js";
import { setupObsidianPrompts } from "./server-prompts.js";
import { setupObsidianTools } from "./server-tools.js";

export class ObsidianServer {
  private server: Server;

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
    setupObsidianTools(this.server);
    setupObsidianPrompts(this.server);
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
