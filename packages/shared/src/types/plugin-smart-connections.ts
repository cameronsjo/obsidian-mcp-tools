import { type } from "arktype";

/**
 * SmartSearch filter options
 */
export const SmartSearchFilter = type({
  "exclude_key?": type("string").describe("A single key to exclude."),
  "exclude_keys?": type("string[]").describe(
    "An array of keys to exclude. If exclude_key is provided, it's added to this array.",
  ),
  "exclude_key_starts_with?": type("string").describe(
    "Exclude keys starting with this string.",
  ),
  "exclude_key_starts_with_any?": type("string[]").describe(
    "Exclude keys starting with any of these strings.",
  ),
  "exclude_key_includes?": type("string").describe(
    "Exclude keys that include this string.",
  ),
  "key_ends_with?": type("string").describe(
    "Include only keys ending with this string.",
  ),
  "key_starts_with?": type("string").describe(
    "Include only keys starting with this string.",
  ),
  "key_starts_with_any?": type("string[]").describe(
    "Include only keys starting with any of these strings.",
  ),
  "key_includes?": type("string").describe(
    "Include only keys that include this string.",
  ),
  "limit?": type("number").describe("Limit the number of search results."),
});

export type SearchFilter = typeof SmartSearchFilter.infer;

/**
 * Interface for the SmartBlock class which represents a single block within a SmartSource
 */
interface SmartBlock {
  // Core properties
  key: string;
  path: string;
  data: {
    text: string | null;
    length: number;
    last_read: {
      hash: string | null;
      at: number;
    };
    embeddings: Record<string, unknown>;
    lines?: [number, number]; // Start and end line numbers
  };

  // Vector-related properties
  vec: number[] | undefined;
  tokens: number | undefined;

  // State flags
  excluded: boolean;
  is_block: boolean;
  is_gone: boolean;

  // Content properties
  breadcrumbs: string;
  file_path: string;
  file_type: string;
  folder: string;
  link: string;
  name: string;
  size: number;

  // Methods
  read(): Promise<string>;
  nearest(filter?: SearchFilter): Promise<SearchResult[]>;
}

/**
 * Interface for a single search result
 */
interface SearchResult {
  item: SmartBlock;
  score: number;
}

/**
 * Interface for the SmartSearch class which provides the main search functionality
 */
export interface SmartSearch {
  /**
   * Searches for relevant blocks based on the provided search text
   * @param search_text - The text to search for
   * @param filter - Optional filter parameters to refine the search
   * @returns A promise that resolves to an array of search results, sorted by relevance score
   */
  search(search_text: string, filter?: SearchFilter): Promise<SearchResult[]>;
}
