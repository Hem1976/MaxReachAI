/**
 * MJML 5 returns a Promise and ships no types of its own. The community
 * `@types/mjml` package describes the synchronous v4 API, so the module is
 * declared here to match what is actually installed.
 */
declare module "mjml" {
  interface MjmlError {
    line: number;
    message: string;
    tagName: string;
    formattedMessage: string;
  }

  interface MjmlOptions {
    fonts?: Record<string, string>;
    keepComments?: boolean;
    beautify?: boolean;
    minify?: boolean;
    validationLevel?: "strict" | "soft" | "skip";
    filePath?: string;
  }

  interface MjmlResult {
    html: string;
    errors: MjmlError[];
  }

  export default function mjml2html(
    mjml: string,
    options?: MjmlOptions,
  ): Promise<MjmlResult>;
}
