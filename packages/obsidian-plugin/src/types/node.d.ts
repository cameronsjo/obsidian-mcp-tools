// Type declarations for NodeJS modules
declare module 'fs' {
  function readFileSync(path: string, options: string): string;
  function existsSync(path: string): boolean;
  function watch(path: string, options: { recursive: boolean }): any;
}

declare module 'path' {
  function join(...paths: string[]): string;
  function parse(path: string): { base: string };
}

declare module 'process' {
  const cwd: () => string;
  const exit: (code: number) => void;
  const env: Record<string, string | undefined>;
  const argv: string[];
}

// Bun type declaration
declare const Bun: {
  file: (path: string) => { json: () => Promise<any>, text: () => Promise<string>, toString: () => string };
  build: (config: any) => Promise<any>;
  write: (path: string, content: string) => Promise<void>;
};
