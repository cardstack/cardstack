interface CardErrorOptions {
  cause?: unknown;
}
export class CardError extends Error {
  isCardError = true;
  cause?: unknown;

  constructor(message: string, options: CardErrorOptions = {}) {
    super(message);
    if (options.cause) {
      this.cause = options.cause;
    }
  }

  static fromError(error: any, options?: CardErrorOptions): CardError {
    return new CardError(error.message, Object.assign({ cause: error }, options));
  }
}

export function printCompilerError(err: any) {
  if (isAcceptableError(err)) {
    return String(err);
  }

  return `${err.message}\n\n${err.stack}`;
}

function isAcceptableError(err: any) {
  return err.isCardError || err.code === 'BABEL_PARSE_ERROR';
}
