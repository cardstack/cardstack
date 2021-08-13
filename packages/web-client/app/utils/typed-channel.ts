import config from '../config/environment';
import { SimpleEmitter, UnbindEventListener } from './events';

export class TypedChannel<MessageType = any> {
  channelName: string;
  broadcastChannel: BroadcastChannel | MockBroadcastChannel;

  constructor(channelName: string) {
    this.channelName = channelName;
    if (config.environment === 'test') {
      this.broadcastChannel = new MockBroadcastChannel(channelName);
    } else {
      this.broadcastChannel = new BroadcastChannel(channelName);
    }
  }

  addEventListener(
    event: keyof BroadcastChannelEventMap,
    callback: (ev: MessageEvent<MessageType>) => any
  ) {
    this.broadcastChannel.addEventListener(event, callback);
  }

  removeEventListener(
    event: keyof BroadcastChannelEventMap,
    callback: (ev: MessageEvent<MessageType>) => any
  ) {
    this.broadcastChannel.removeEventListener(event, callback);
  }

  close() {
    this.broadcastChannel.close();
  }

  postMessage(message: MessageType) {
    this.broadcastChannel.postMessage(message);
  }

  test__simulateMessageEvent(data: any) {
    if (this.broadcastChannel instanceof MockBroadcastChannel)
      this.broadcastChannel.test__simulateMessageEvent(data);
  }
}

// NOTE: the message event used in this object only contains the data property
// see https://developer.mozilla.org/en-US/docs/Web/API/MessageEvent for more
// properties, if extending this to be more realistic
class MockBroadcastChannel {
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
