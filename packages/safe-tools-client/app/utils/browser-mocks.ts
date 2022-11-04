import { SimpleEmitter, UnbindEventListener } from './events';

/**
 *  Mock broadcast channel with a subset of broadcast channel functionality.
 *  Use `test__simulateMessageEvent` to simulate a message event with only the data property
 */

type EventCallback = (ev: unknown) => unknown;

export class MockBroadcastChannel {
  postedMessages: Array<unknown> = [];
  channelName: string;
  private simpleEmitter = new SimpleEmitter();
  private unbindMap: {
    message: WeakMap<EventCallback, UnbindEventListener>;
    messageerror: WeakMap<EventCallback, UnbindEventListener>;
  } = {
    message: new WeakMap(),
    messageerror: new WeakMap(),
  };

  constructor(channelName: string) {
    this.channelName = channelName;
  }

  addEventListener(
    event: keyof BroadcastChannelEventMap,
    callback: (ev: unknown) => unknown
  ) {
    const unbind = this.simpleEmitter.on(event, callback);
    this.unbindMap[event].set(callback, unbind);
  }

  removeEventListener(
    event: keyof BroadcastChannelEventMap,
    callback: (ev: unknown) => unknown
  ) {
    const unbind = this.unbindMap[event].get(callback);
    if (unbind) {
      unbind();
      this.unbindMap[event].delete(callback);
    }
  }

  postMessage(message: unknown) {
    this.postedMessages.push(message);
  }

  test__simulateMessageEvent(data: unknown) {
    const payload = {
      data,
    };
    this.simpleEmitter.emit('message', payload as MessageEvent);
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  close() {}
}

declare global {
  interface Window {
    TEST__MOCK_LOCAL_STORAGE_INIT?: Record<string, string>;
  }
}

export class MockLocalStorage {
  entries = {} as Record<string, string>;

  constructor() {
    if (window.TEST__MOCK_LOCAL_STORAGE_INIT) {
      for (const key in window.TEST__MOCK_LOCAL_STORAGE_INIT) {
        this.setItem(key, window.TEST__MOCK_LOCAL_STORAGE_INIT[key]);
      }
    }
  }

  setItem(key: string, value: string): void {
    this.entries[key] = value;
  }
  getItem(key: string): string | null {
    return this.entries[key] ?? null;
  }
  removeItem(key: string): void {
    delete this.entries[key];
  }
  get length(): number {
    return Object.keys(this.entries).length;
  }
  clear() {
    for (const key in this.entries) {
      delete this.entries[key];
    }
  }
}
