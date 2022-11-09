import config from '../config/environment';

import { MockBroadcastChannel } from './browser-mocks';

export class TypedChannel<MessageType = unknown> {
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
    callback: (ev: MessageEvent<MessageType>) => unknown
  ) {
    this.broadcastChannel.addEventListener(event, callback);
  }

  removeEventListener(
    event: keyof BroadcastChannelEventMap,
    callback: (ev: MessageEvent<MessageType>) => unknown
  ) {
    this.broadcastChannel.removeEventListener(event, callback);
  }

  close() {
    this.broadcastChannel.close();
  }

  postMessage(message: MessageType) {
    this.broadcastChannel.postMessage(message);
  }

  test__simulateMessageEvent(data: unknown) {
    if (this.broadcastChannel instanceof MockBroadcastChannel)
      this.broadcastChannel.test__simulateMessageEvent(data);
  }
}
