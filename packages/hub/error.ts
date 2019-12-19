/*
  Writers and Searchers should throw errors of this class in order for
  the server to generate friendly, JSONAPI error responses.

  The arguments to this class are defined via
  http://jsonapi.org/format/#error-objects

*/

import Logger from '@cardstack/logger';
import { STATUS_CODES } from 'http';
import Koa from 'koa';

const log = Logger('cardstack/error');

interface ErrorDetails {
  status?: number;
  title?: string;
  source?: {
    pointer?: string;
    header?: string;
    parameter?: string;
  };
}

class CardstackError extends Error {
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
    this.title = title || STATUS_CODES[this.status];
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

  static async withJsonErrorHandling(ctxt: Koa.Context, fn: Koa.Next) {
    try {
      return await fn();
    } catch (err) {
      if (!err.isCardstackError) {
        throw err;
      }
      if (err.status === 500) {
        log.error(`Unexpected error: ${err.status} - ${err.message}\n${err.stack}`);
      }
      let errors = [err];
      if (err.additionalErrors) {
        errors = errors.concat(err.additionalErrors);
      }
      ctxt.body = { errors };
      ctxt.status = errors[0].status;
    }
  }
}

export default CardstackError;
