/** Error thrown for invalid configuration or input. Message always starts with `[nextjs-seo-kit]`. */
export class SeoKitError extends Error {
  constructor(message: string) {
    super(`[nextjs-seo-kit] ${message}`);
    this.name = 'SeoKitError';
  }
}
