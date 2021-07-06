import { pluralize, singularize } from 'ember-inflector';
import { camelize } from '@ember/string';
import type { TestContext } from 'ember-test-helpers';
import { setupMirage as originalSetupMirage } from 'ember-cli-mirage/test-support';

import { AnyRegistry } from 'miragejs/-types';
import type { Request as RequestType } from 'miragejs';
import { RouteHandler } from 'miragejs/server';
import Schema from 'miragejs/orm/schema';

declare module 'ember-test-helpers' {
  interface TestContext {
    onRequest: typeof onRequest;
  }
}

export function setupMirage(hooks: NestedHooks): void {
  originalSetupMirage(hooks);
  hooks.beforeEach(function () {
    this.onRequest = onRequest.bind(this);
  });
}

type RequestCallback = (reponse: {
  payload: any;
  schema: Schema<AnyRegistry>;
  request: RequestType;
}) => void;

function onRequest(
  this: TestContext,
  method: 'post' | 'patch' | 'delete',
  path: string,
  callback: RequestCallback
): void {
  let modelName = singularize(path.split('/').filter(Boolean)[0]);

  switch (method) {
    case 'patch':
      this.server.patch(
        path,
        function (this: RouteHandler<AnyRegistry>, schema, request) {
          let payload = JSON.parse(request.requestBody);
          callback.call(this, { payload, schema, request });
          let modelSchema = schema[camelize(pluralize(modelName))];
          return modelSchema.find(request.params.id).update(attrs);
        }
      );
      break;
    case 'post':
      this.server.post(path, function (schema, request) {
        // let attrs = getAttrsForJSONApiRequest(this, request, modelName);
        // handler.call(this, { attrs, schema, request });
        // let modelSchema = schema[camelize(pluralize(modelName))];
        // return modelSchema.create(attrs);
      });
      break;
    case 'delete':
      this.server.delete(path, function (schema, request) {
        // handler.call(this, { schema, request });
        // let modelName = singularize(path.split('/').filter(Boolean)[0]);
        // let modelSchema = schema[camelize(pluralize(modelName))];
        // let model = modelSchema.find(request.params.id);
        // model.destroy();
      });
      break;
  }
}
