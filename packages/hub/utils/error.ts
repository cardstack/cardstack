/*
  Writers and Searchers should throw errors of this class in order for
  the server to generate friendly, JSONAPI error responses.

  The arguments to this class are defined via
  http://jsonapi.org/format/#error-objects

*/

// using npm pkg instead of node built-in module since this needs to work on the browser too.
import { getStatusText } from 'http-status-codes';

interface ErrorDetails {
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
  additionalErrors: CardstackError[] | null = null;

  constructor(detail: string, { status, title, source }: ErrorDetails = {}) {
    super(detail);
    this.detail = detail;
    this.status = status || 500;
    this.title = title || getStatusText(this.status);
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

export class NotFound extends Error {
  status = 404;
}
export class BadRequest extends Error {
  status = 400;
}

export class Conflict extends Error {
  status = 409;
}
