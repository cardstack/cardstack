import config from '../config/environment';
import { MockBroadcastChannel } from './browser-mocks';

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
