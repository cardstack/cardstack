import { SimpleEmitter, UnbindEventListener } from './events';

/**
 *  Mock broadcast channel with a subset of broadcast channel functionality.
 *  Use `test__simulateMessageEvent` to simulate a message event with only the data property
 */
export class MockBroadcastChannel {
  postedMessages: Array<any> = [];
  channelName: string;
  private simpleEmitter = new SimpleEmitter();
  private unbindMap: {
    message: WeakMap<Function, UnbindEventListener>;
    messageerror: WeakMap<Function, UnbindEventListener>;
  } = {
    message: new WeakMap(),
    messageerror: new WeakMap(),
  };

  constructor(channelName: string) {
    this.channelName = channelName;
  }

  addEventListener(
    event: keyof BroadcastChannelEventMap,
    callback: (ev: any) => any
  ) {
    let unbind = this.simpleEmitter.on(event, callback);
    this.unbindMap[event].set(callback, unbind);
  }

  removeEventListener(
    event: keyof BroadcastChannelEventMap,
    callback: (ev: any) => any
  ) {
    let unbind = this.unbindMap[event].get(callback);
    if (unbind) {
      unbind();
      this.unbindMap[event].delete(callback);
    }
  }

  postMessage(message: any) {
    this.postedMessages.push(message);
  }

  test__simulateMessageEvent(data: any) {
    let payload = {
      data,
    };
    this.simpleEmitter.emit('message', payload as MessageEvent);
  }

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
      this.entries = {
        ...window.TEST__MOCK_LOCAL_STORAGE_INIT,
      };
    }
  }

  setItem(key: string, value: string): void {
    this.entries[key] = value;
  }
  getItem(key: string): string | null {
    return this.entries[key];
  }
  removeItem(key: string): void {
    delete this.entries[key];
  }
  get length(): number {
    return Object.keys(this.entries).length;
  }
  clear() {
    this.entries = {};
  }
}
