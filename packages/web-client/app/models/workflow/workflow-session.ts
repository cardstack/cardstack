/* eslint-disable no-dupe-class-members */
import {
  BridgeValidationResult,
  Safe,
  TokenInfo,
} from '@cardstack/cardpay-sdk';
import { isPresent } from '@ember/utils';
import { tracked } from '@glimmer/tracking';
import BN from 'bn.js';
import { TransactionReceipt } from 'web3-core';

interface WorkflowMeta {
  updatedAt: string | undefined;
  createdAt: string | undefined;
  completedCardNames: string[] | undefined;
  completedMilestonesCount: number | undefined;
  milestonesCount: number | undefined;
  isCancelled: boolean | undefined;
  cancelationReason: string | undefined;
}

export interface WorkflowSessionDictionary {
  [key: string]: SupportedType;
  meta: Partial<WorkflowMeta>;
}

type JSONSerializable =
  | string
  | number
  | boolean
  | null
  | BridgeValidationResult
  | Safe
  | TokenInfo
  | TransactionReceipt
  | JSONSerializable[];
export type SupportedType =
  | JSONSerializable
  | Record<string, JSONSerializable>
  | Date
  | BN
  | WorkflowMeta
  | undefined;

function stateProxyHandler(workflowSession: WorkflowSession) {
  return {
    get(_target: unknown, key: string | symbol) {
      if (key.toString() in workflowSession._state) {
        return workflowSession.getValue(key.toString());
      }
      return undefined;
    },
    set(_target: unknown, key: string | symbol, value: SupportedType) {
      workflowSession.setValue(key.toString(), value);
      return true;
    },
    deleteProperty(_target: unknown, key: string | symbol) {
      return delete workflowSession._state[key.toString()];
    },
    ownKeys: function (_target: unknown) {
      return Object.keys(workflowSession._state);
    },
    has(_target: unknown, key: string | symbol) {
      return key in workflowSession._state;
    },
    defineProperty: function (
      _target: unknown,
      _key: string | symbol,
      _desc: unknown
    ) {
      throw new Error('Unsupported operation');
    },
    getOwnPropertyDescriptor: function (
      _target: unknown,
      key: string | symbol
    ) {
      let value = workflowSession.getValue(key.toString());
      return value
        ? {
            value,
            writable: true,
            enumerable: true,
            configurable: true,
          }
        : undefined;
    },
  };
}

export default class WorkflowSession {
  workflow: any;
  #stateProxy: any;
  constructor(workflow?: any) {
    this.workflow = workflow;
    this.#stateProxy = new Proxy({}, stateProxyHandler(this));
  }

  @tracked _state: Record<string, string> = {};

  delete(key: string) {
    delete this._state[key];
    // eslint-disable-next-line no-self-assign
    this._state = this._state; // for reactivity

    this.persistToStorage();
  }

  get state(): Record<string, SupportedType> {
    return this.#stateProxy;
  }

  get hasPersistence() {
    return isPresent(this.workflow?.workflowPersistenceId);
  }

  restoreFromStorage(): void {
    if (!this.hasPersistence) return;

    let persistedData = this.getPersistedData();
    this._state = persistedData?.state || {};
  }

  getPersistedData(): any {
    return this.workflow?.workflowPersistence.getPersistedData(
      this.workflow.workflowPersistenceId
    );
  }

  getValue<T extends SupportedType>(key: string): T | null {
    const data: string | null = this._state[key];
    if (data !== null && data !== undefined) {
      let json = JSON.parse(data);
      if (json.type === 'Date') {
        return new Date(json.value) as T;
      } else if (json.type === 'BN') {
        return new BN(json.value) as T;
      } else {
        return json.value;
      }
    }
    return null;
  }

  getValues(): Record<string, SupportedType> {
    let result: Record<string, SupportedType> = {};
    for (const key in this._state) {
      const data: string | null = this._state[key];
      if (data !== null && data !== undefined) {
        let json = JSON.parse(data);
        if (json.type === 'Date') {
          result[key] = new Date(json.value);
        } else if (json.type === 'BN') {
          result[key] = new BN(json.value);
        } else {
          result[key] = json.value;
        }
      }
    }
    return result;
  }

  setValue(key: string, value: SupportedType): void;
  setValue(hash: Record<string, SupportedType>): void;
  setValue(
    hashOrKey: Record<string, SupportedType> | string,
    value?: SupportedType
  ): void {
    if (typeof hashOrKey === 'string') {
      if (hashOrKey === 'meta') {
        throw new Error('Please use setMeta to set meta values');
      }
      this.setStateProperty(hashOrKey, value!);
    } else {
      if (hashOrKey.meta) {
        throw new Error('Please use setMeta to set meta values');
      }
      for (const key in hashOrKey) {
        this.setStateProperty(key, hashOrKey[key]);
      }
    }
    // eslint-disable-next-line no-self-assign
    this._state = this._state; // for reactivity
    this.persistToStorage();
  }

  setMeta(hash: Partial<WorkflowMeta>, persist = true): void {
    this.setStateProperty('meta', {
      ...(this.getMeta() || {}),
      ...hash,
    });
    // eslint-disable-next-line no-self-assign
    this._state = this._state; // for reactivity
    if (persist) this.persistToStorage();
  }

  getMeta() {
    return this.getValue('meta') as WorkflowMeta;
  }

  private setStateProperty(key: string, value: SupportedType) {
    serializeToState(this._state, key, value);
  }

  private persistToStorage(): void {
    if (!this.hasPersistence) return;

    // first persistence will set both updatedAt and createdAt to the same date
    let updatedAt = new Date().toISOString();
    let createdAt = this.getMeta()?.createdAt || updatedAt;

    // persist must be false to avoid infinite recursion
    this.setMeta({ updatedAt, createdAt }, false);

    this.workflow?.workflowPersistence.persistData(
      this.workflow.workflowPersistenceId,
      {
        name: this.workflow.name,
        state: this._state,
      }
    );
  }
}

export function serializeToState(
  state: Record<string, string>,
  key: string,
  value: SupportedType
) {
  if (value instanceof Date) {
    state[key] = JSON.stringify({
      value: value.toISOString(),
      type: 'Date',
    });
  } else if (BN.isBN(value)) {
    state[key] = JSON.stringify({
      value: value.toString(),
      type: 'BN',
    });
  } else {
    state[key] = JSON.stringify({ value });
  }
}

// A useful util for tests
export function buildState(
  data: Record<string, SupportedType>
): Record<string, any> {
  let result = {};
  for (let key in data) {
    serializeToState(result, key, data[key]);
  }
  return result;
}
