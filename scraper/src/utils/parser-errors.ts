/**
 * Error thrown when the HTML parser detects an unexpected page structure,
 * indicating the target site may have changed its markup.
 */
export class ParserStructureError extends Error {
  constructor(
    message: string,
    public selector: string,
    public url?: string
  ) {
    super(message);
    this.name = 'ParserStructureError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ParserStructureError);
    }
  }
}
