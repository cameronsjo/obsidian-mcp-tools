import { type } from "arktype";
import { Request, Response } from "express";
import { Notice, Plugin, TFile } from "obsidian";
import { LocalRestApiPublicApi } from "obsidian-local-rest-api";
import { shake } from "radash";
import { ExecutePromptParamsSchema, PromptArgAccessor } from "shared";
import { logger } from "./logger";
import {
	loadLocalRestAPI,
	loadSmartSearchAPI,
	loadTemplaterAPI,
} from "./plugins";
import { searchFilter } from "./plugins/SmartSearch";
import { RunMode } from "./plugins/Templater";

const isProduction = process.env.NODE_ENV === "production";

const searchRequest = type({
	query: type("string>0").describe("A search phrase for semantic search"),
	"filter?": {
		"folders?": type("string[]").describe(
			'An array of folder names to include. For example, ["Public", "Work"]',
		),
		"excludeFolders?": type("string[]").describe(
			'An array of folder names to exclude. For example, ["Private", "Archive"]',
		),
		"limit?": type("number>0").describe(
			"The maximum number of results to return",
		),
	},
});
const jsonSearchRequest = type("string.json.parse").to(searchRequest);

const searchResponse = type({
	results: type({
		path: "string",
		text: "string",
		score: "number",
		breadcrumbs: "string",
	}).array(),
});
type SearchResponse = typeof searchResponse.infer;

const searchParameters = type({ query: "string", filter: searchFilter });

export default class SmartSearchRestAPIPlugin extends Plugin {
	private localRestApi: LocalRestApiPublicApi | undefined;

	async onload() {
		// Check for required dependencies
		this.localRestApi = await loadLocalRestAPI(this.app, this.manifest);
		if (!this.localRestApi) {
			new Notice(
				"Smart Search REST API Plugin: local-rest-api plugin is required but not found. Please install it from the community plugins.",
				0,
			);
			return;
		}

		// Register endpoints
		this.localRestApi
			.addRoute("/search/smart")
			.post(this.handleSearchRequest.bind(this));

		this.localRestApi
			.addRoute("/templates/execute")
			.post(this.handleTemplateExecution.bind(this));
	}

	private async handleTemplateExecution(req: Request, res: Response) {
		try {
			const templater = await loadTemplaterAPI(this.app);
			if (!templater) {
				new Notice(
					"Smart Search REST API Plugin: templater plugin is required but not found. Please install it from the community plugins.",
					0,
				);
				logger.error("Templater plugin is not available");
				res.status(503).json({
					error: "Templater plugin is not available",
				});
				return;
			}

			// Validate request body
			const params = ExecutePromptParamsSchema(req.body);
			if (params instanceof type.errors) {
				const meta = { body: req.body, summary: params.summary };
				logger.error("Invalid request body", meta);
				res.status(400).json({
					error: "Invalid request body",
					// Don't respond with request body in production
					...(isProduction ? {} : meta),
				});
				return;
			}

			// Get prompt content from vault
			const templatePath = `Prompts/${params.name}`;
			const templateFile =
				this.app.vault.getAbstractFileByPath(templatePath);
			if (!(templateFile instanceof TFile)) {
				logger.debug("Template file not found", {
					params,
					templateFile,
					templatePath,
				});
				res.status(404).json({
					error: `File not found: ${templatePath}`,
				});
				return;
			}

			const config = templater.create_running_config(
				templateFile,
				templateFile,
				RunMode.CreateNewFromTemplate,
			);

			const promptArg: PromptArgAccessor = (argName: string) => {
				return params.arguments[argName] ?? "";
			};

			const oldGenerateObject =
				templater.functions_generator.generate_object.bind(
					templater.functions_generator,
				);

			// Override generate_object to inject promptArg into user functions
			templater.functions_generator.generate_object = async function (
				config,
				functions_mode,
			) {
				const functions = await oldGenerateObject(
					config,
					functions_mode,
				);
				const user = functions.user;
				user.promptArg = promptArg;
				return { ...functions, user };
			};

			// Process template with variables
			const processedContent =
				await templater.read_and_parse_template(config);

			// Restore original functions generator
			templater.functions_generator.generate_object = oldGenerateObject;

			// Create new file if requested
			if (params.createFile && params.targetPath) {
				await this.app.vault.create(
					params.targetPath,
					processedContent,
				);
				res.json({
					message: "Prompt executed and file created successfully",
					content: processedContent,
				});
				return;
			}

			res.json({
				message: "Prompt executed without creating a file",
				content: processedContent,
			});
		} catch (error) {
			logger.error("Prompt execution error:", {
				error: error instanceof Error ? error.message : error,
				body: req.body,
			});
			res.status(503).json({
				error: "An error occurred while processing the prompt",
			});
			return;
		}
	}

	private async handleSearchRequest(req: Request, res: Response) {
		try {
			const smartSearch = await loadSmartSearchAPI();
			if (!smartSearch) {
				new Notice(
					"Smart Search REST API Plugin: smart-connections plugin is required but not found. Please install it from the community plugins.",
					0,
				);
				res.status(503).json({
					error: "Smart Connections plugin is not available",
				});
				return;
			}

			// Validate request body
			const requestBody = jsonSearchRequest
				.pipe(({ query, filter = {} }) => ({
					query,
					filter: shake({
						key_starts_with_any: filter.folders,
						exclude_key_starts_with_any: filter.excludeFolders,
						limit: filter.limit,
					}),
				}))
				.to(searchParameters)(req.body);
			if (requestBody instanceof type.errors) {
				res.status(400).json({
					error: "Invalid request body",
					summary: requestBody.summary,
				});
				return;
			}

			// Perform search
			const results = await smartSearch.search(
				requestBody.query,
				requestBody.filter,
			);

			// Format response
			const response: SearchResponse = {
				results: await Promise.all(
					results.map(async (result) => ({
						path: result.item.path,
						text: await result.item.read(),
						score: result.score,
						breadcrumbs: result.item.breadcrumbs,
					})),
				),
			};

			res.json(response);
			return;
		} catch (error) {
			logger.error("Smart Search API error:", { error, body: req.body });
			res.status(503).json({
				error: "An error occurred while processing the search request",
			});
			return;
		}
	}

	onunload() {
		// Clean up endpoint registration if needed
		if (this.localRestApi) {
			this.localRestApi.unregister();
		}
	}
}
