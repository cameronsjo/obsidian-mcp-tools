/**
 * Types for the unified tool dispatch system
 *
 * This module provides the foundation for consolidating 21+ individual tools
 * into ~5 dispatcher tools with runtime operation discovery.
 */

/**
 * Standard result type for all operations
 */
export interface OperationResult {
  content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }>;
  isError?: boolean;
}

/**
 * Parameter definition for an operation
 */
export interface ParameterDefinition {
  type: string;
  description?: string;
  required?: boolean;
  default?: unknown;
}

/**
 * Definition of a single operation within a dispatcher
 */
export interface OperationDefinition {
  name: string;
  description: string;
  parameters: Record<string, ParameterDefinition>;
  handler: (params: Record<string, unknown>) => Promise<OperationResult>;
}

/**
 * Base interface for all dispatcher categories
 */
export interface DispatcherCapabilities {
  category: string;
  description: string;
  operations: Record<string, Omit<OperationDefinition, "handler">>;
}

/**
 * Full capability manifest returned by discover tool
 */
export interface CapabilityManifest {
  vault: DispatcherCapabilities;
  active_file: DispatcherCapabilities;
  plugins: {
    [pluginId: string]: DispatcherCapabilities & {
      enabled: boolean;
      version?: string;
    };
  };
}

/**
 * Operation handler type
 */
export type OperationHandler = (
  params: Record<string, unknown>,
) => Promise<OperationResult>;

/**
 * Registry of operations for a dispatcher
 */
export class OperationRegistry {
  private operations = new Map<string, OperationDefinition>();

  register(operation: OperationDefinition): this {
    this.operations.set(operation.name, operation);
    return this;
  }

  get(name: string): OperationDefinition | undefined {
    return this.operations.get(name);
  }

  list(): string[] {
    return Array.from(this.operations.keys());
  }

  getCapabilities(): Record<string, Omit<OperationDefinition, "handler">> {
    const capabilities: Record<string, Omit<OperationDefinition, "handler">> = {};
    for (const [name, op] of this.operations) {
      capabilities[name] = {
        name: op.name,
        description: op.description,
        parameters: op.parameters,
      };
    }
    return capabilities;
  }

  async dispatch(
    operation: string,
    params: Record<string, unknown>,
  ): Promise<OperationResult> {
    const op = this.operations.get(operation);
    if (!op) {
      return {
        content: [
          {
            type: "text",
            text: `Unknown operation: ${operation}. Available operations: ${this.list().join(", ")}`,
          },
        ],
        isError: true,
      };
    }
    return op.handler(params);
  }
}
