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
import { Workflow } from '../workflow';

export interface IWorkflowSession {
  delete(key: string): void;
  getMeta(): WorkflowMeta;
  getValue<T extends SupportedType>(key: string): T | null;
  hasPersistedState(): boolean;
  restoreFromStorage(): void;
  setMeta(hash: Partial<WorkflowMeta>): void;
  setMeta(hash: Partial<WorkflowMeta>, persist: boolean): void;
  setValue(key: string, value: SupportedType): void;
  setValue(hash: WorkflowSessionDictionary): void;
  workflow: Workflow | undefined;
}

export interface WorkflowMeta {
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
  meta?: Partial<WorkflowMeta>;
}

type SerializedWorkflowState = Record<string, string>;

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

export default class WorkflowSession implements IWorkflowSession {
  workflow: Workflow | undefined;
  #stateProxy: any;
  constructor(workflow?: Workflow) {
    this.workflow = workflow;
    this.#stateProxy = new Proxy({}, stateProxyHandler(this));
  }

  @tracked _state: SerializedWorkflowState = {};

  delete(key: string) {
    delete this._state[key];
    // eslint-disable-next-line no-self-assign
    this._state = this._state; // for reactivity

    this.persistToStorage();
  }

  get state(): WorkflowSessionDictionary {
    return this.#stateProxy;
  }

  hasPersistence(): this is { workflow: { workflowPersistenceId: string } } {
    return isPresent(this.workflow?.workflowPersistenceId);
  }

  hasPersistedState() {
    return (
      this.hasPersistence() &&
      Object.keys(this.getPersistedData()?.state || {}).length > 0
    );
  }

  restoreFromStorage(): void {
    if (!this.hasPersistence()) return;

    let persistedData = this.getPersistedData();
    this._state = persistedData?.state || ({} as SerializedWorkflowState);
  }

  getPersistedData(): { state?: SerializedWorkflowState } {
    if (!this.hasPersistence()) return {};

    return this.workflow.workflowPersistence.getPersistedData(
      this.workflow.workflowPersistenceId
    );
  }

  getValue<T extends SupportedType>(key: string): T | null {
    return deserializeValue<T>(this._state[key]);
  }

  getValues(): WorkflowSessionDictionary {
    return deserializeState(this._state);
  }

  setValue(key: string, value: SupportedType): void;
  setValue(hash: WorkflowSessionDictionary): void;
  setValue(
    hashOrKey: WorkflowSessionDictionary | string,
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

  getMeta(): WorkflowMeta {
    return this.getValue('meta') || ({} as WorkflowMeta);
  }

  private setStateProperty(key: string, value: SupportedType) {
    serializeToState(this._state, key, value);
  }

  private persistToStorage(): void {
    if (!this.hasPersistence()) return;

    // first persistence will set both updatedAt and createdAt to the same date
    let updatedAt = new Date().toISOString();
    let createdAt = this.getMeta()?.createdAt || updatedAt;

    // persist must be false to avoid infinite recursion
    this.setMeta({ updatedAt, createdAt }, false);

    this.workflow.workflowPersistence.persistData(
      this.workflow.workflowPersistenceId,
      {
        name: this.workflow.name,
        state: this._state,
      }
    );
  }
}

function deserializeValue<T extends SupportedType>(
  data: string | null | undefined
): T | null {
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

export function deserializeState(
  state: SerializedWorkflowState
): WorkflowSessionDictionary {
  let res: WorkflowSessionDictionary = {};

  for (let key in state) {
    let value = deserializeValue(state[key]);
    if (value !== null) {
      res[key] = value;
    }
  }

  return res;
}

export function serializeToState(
  state: SerializedWorkflowState,
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
  data: WorkflowSessionDictionary
): SerializedWorkflowState {
  let result = {};
  for (let key in data) {
    serializeToState(result, key, data[key]);
  }
  return result;
}
