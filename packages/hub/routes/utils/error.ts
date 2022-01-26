import Koa from 'koa';
import { kebabCase } from 'lodash';

/**
 * Sets the Koa Context's response to a JSON-API compliant error
 * ```
 * {
 *   status: statusCode,
 *   body: {
 *     errors: [
 *       { status: statusCode, title, detail }
 *     ]
 *   },
 *   type: 'application/vnd.api+json'
 * }
 * ```
 */
export function handleError(ctx: Koa.Context, statusCode: number, title: string, detail?: string) {
  let error: { status: string; title: string; detail?: string } = {
    status: `${statusCode}`,
    title,
  };
  if (detail) {
    error.detail = detail;
  }

  ctx.status = statusCode;
  ctx.body = {
    errors: [error],
  };
  ctx.type = 'application/vnd.api+json';
}

export interface NestedAttributeError {
  index: number;
  attribute: string;
  detail: string;
}

export function serializeErrors(errors: any) {
  return Object.keys(errors).flatMap((attribute) => {
    let errorsForAttribute = errors[attribute];
    return errorsForAttribute.map((error: string | NestedAttributeError) => {
      if (typeof error === 'string') {
        return {
          status: '422',
          title: 'Invalid attribute',
          source: { pointer: `/data/attributes/${kebabCase(attribute)}` },
          detail: error,
        };
      } else {
        return {
          status: '422',
          title: 'Invalid attribute',
          source: { pointer: `/data/attributes/${kebabCase(attribute)}/${error.index}/${kebabCase(error.attribute)}` },
          detail: error.detail,
        };
      }
    });
  });
}
