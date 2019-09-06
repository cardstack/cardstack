/*
  Writers and Searchers should throw errors of this class in order for
  the server to generate friendly, JSONAPI error responses.

  The arguments to this class are defined via
  http://jsonapi.org/format/#error-objects

*/

import { todo } from './todo-any';
import Logger from '@cardstack/logger';
import { STATUS_CODES } from 'http';

const log: todo = Logger('cardstack/error');

interface ErrorDetails {
  status?: number;
  title?: string;
  source?: todo;
}

class E extends Error {
  detail: string;
  status: number;
  title?: string;
  source?: todo;
  isCardstackError: boolean;
  additionalErrors: todo;

  constructor(detail: todo, { status, title, source}: ErrorDetails = {}) {
    super(detail);
    this.detail = detail;
    this.status = status || 500;
    this.title = title || STATUS_CODES[this.status];
    this.source = source;
    this.isCardstackError = true;
    this.additionalErrors = null;
  }
  toJSON() {
    return {
      title: this.title,
      detail: this.detail,
      code: this.status,
      source: this.source
    };
  }

  static async withJsonErrorHandling(ctxt: todo, fn: todo) {
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

export = E;