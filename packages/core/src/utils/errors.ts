import { getReasonPhrase } from 'http-status-codes';

export interface ErrorDetails {
  status?: number;
  title?: string;
  source?: {
    pointer?: string;
    header?: string;
    parameter?: string;
  };
}

export class CardstackError extends Error {
  detail: string;
  status: number;
  title?: string;
  source?: ErrorDetails['source'];
  isCardstackError: true = true;
  additionalErrors: (CardstackError | Error)[] | null = null;

  constructor(detail: string, { status, title, source }: ErrorDetails = {}) {
    super(detail);
    this.detail = detail;
    this.status = status || 500;
    this.title = title || getReasonPhrase(this.status);
    this.source = source;
  }
  toJSON() {
    return {
      title: this.title,
      detail: this.detail,
      code: this.status,
      source: this.source,
    };
  }
}

export class NotFound extends CardstackError {
  status = 404;
  title = 'Not Found';
}
export class BadRequest extends CardstackError {
  status = 400;
  title = 'Bad Request';
}

export class Conflict extends CardstackError {
  status = 409;
  title = 'Conflict';
}

export function augmentBadRequest(error: any) {
  error.status = 400;
  error.isCardstackError = true;

  return error;
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
