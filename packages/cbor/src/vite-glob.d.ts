// Minimal typing for the eager `import.meta.glob` used in tests to read
// source files as text. Keeps node type dependencies out of this package.
interface ImportMeta {
  glob(
    pattern: string,
    options: { query: string; import: string; eager: true },
  ): Record<string, string>;
}
