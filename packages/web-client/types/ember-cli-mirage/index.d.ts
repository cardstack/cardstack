import {
  ActiveModelSerializer,
  Collection,
  Factory,
  Instantiate,
  JSONAPISerializer,
  Model,
  ModelInstance,
  Response,
  RestSerializer,
  Serializer,
  Server as MirageServer,
} from 'miragejs';

import { Registry } from '<app-name>/mirage/registry';

/**
 * Result of `server.create('modelName', params);`
 * (including undefined/null props)
 */
export type Init<K extends keyof Registry> = Instantiate<Registry, K>;

/**
 * Params object for `server.create('modelName', params);`
 */
export type Data<K extends keyof Registry> = Partial<ModelInitializer<Init<K>>>;

/**
 * Result of `server.create('modelName', params);`
 * (with undefined/null props removed)
 */
export type Instantiated<I, D> = I &
  {
    [K in keyof I & keyof D]: Exclude<I[K], undefined | null>;
  };

type ModelInitializer<Data> = {
  [K in keyof Data]: Data[K] extends Collection<infer M>
    ? Collection<M> | M[]
    : Data[K];
};

interface Server extends MirageServer<Registry> {
  /**
   * Creates a model of the given type.
   *
   * @param modelName The type of model to instantiate
   * @param [t0] Optional trait name
   * @param [t1] Optional trait name
   * @param [t2] Optional trait name
   * @param [data] Optional initial values for model attributes/relationships
   */
  create<
    ModelName extends keyof Registry,
    I extends Init<ModelName>,
    D extends Data<ModelName>
  >(
    modelName: ModelName,
    data?: Data<ModelName>
  ): Instantiated<I, D>;
  create<
    ModelName extends keyof Registry,
    I extends Init<ModelName>,
    D extends Data<ModelName>
  >(
    modelName: ModelName,
    t0: string,
    data?: Data<ModelName>
  ): Instantiated<I, D>;
  create<
    ModelName extends keyof Registry,
    I extends Init<ModelName>,
    D extends Data<ModelName>
  >(
    modelName: ModelName,
    t0: string,
    t1: string,
    data?: Data<ModelName>
  ): Instantiated<I, D>;
  create<
    ModelName extends keyof Registry,
    I extends Init<ModelName>,
    D extends Data<ModelName>
  >(
    modelName: ModelName,
    t0: string,
    t1: string,
    t2: string,
    data?: Data<ModelName>
  ): Instantiated<I, D>;
  create<
    ModelName extends keyof Registry,
    I extends Init<ModelName>,
    D extends Data<ModelName>
  >(
    modelName: ModelName,
    ...args: unknown[]
  ): Instantiated<I, D>;

  /**
   * Builds a model of the given type.
   *
   * @param modelName The type of model to instantiate
   * @param [t0] Optional trait name
   * @param [t1] Optional trait name
   * @param [t2] Optional trait name
   * @param [data] Optional initial values for model attributes/relationships
   */
  build<
    ModelName extends keyof Registry,
    I extends Init<ModelName>,
    D extends Data<ModelName>
  >(
    modelName: ModelName,
    data?: Data<ModelName>
  ): Instantiated<I, D>;
  build<
    ModelName extends keyof Registry,
    I extends Init<ModelName>,
    D extends Data<ModelName>
  >(
    modelName: ModelName,
    t0: string,
    data?: Data<ModelName>
  ): Instantiated<I, D>;
  build<
    ModelName extends keyof Registry,
    I extends Init<ModelName>,
    D extends Data<ModelName>
  >(
    modelName: ModelName,
    t0: string,
    t1: string,
    data?: Data<ModelName>
  ): Instantiated<I, D>;
  build<
    ModelName extends keyof Registry,
    I extends Init<ModelName>,
    D extends Data<ModelName>
  >(
    modelName: ModelName,
    t0: string,
    t1: string,
    t2: string,
    data?: Data<ModelName>
  ): Instantiated<I, D>;
}

export type { Instantiate, ModelInstance, Server };
export {
  ActiveModelSerializer,
  Collection,
  Factory,
  JSONAPISerializer,
  Model,
  Response,
  RestSerializer,
  Serializer,
};

/**
 * See https://www.ember-cli-mirage.com/docs/data-layer/factories#traits
 *
 * @param extension An extension of the factory to include when the trait name
 *   is used
 */
export function trait<T extends Record<string, unknown>>(
  extension: T
): T & { __isTrait__: true };

/**
 * See https://www.ember-cli-mirage.com/docs/data-layer/factories#the-association-helper
 *
 * @param args Optional arguments that match those that can be passed to
 *   `Server.create`.
 */
export function association<ModelName extends keyof Registry>(
  ...args: unknown[]
): Init<ModelName>;
