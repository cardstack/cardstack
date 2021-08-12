export class TypedChannel<MessageType = any> {
  channelName: string;
  private broadcastChannel: BroadcastChannel;

  constructor(channelName: string) {
    this.channelName = channelName;
    this.broadcastChannel = new BroadcastChannel(channelName);
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
}
