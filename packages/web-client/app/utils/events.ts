export type UnbindEventListener = () => void;

export interface Emitter {
  on(event: string, cb: Function): UnbindEventListener; // eslint-disable-line no-unused-vars
}

export class DappEvents {
  events: Record<string, Function[]> = {};

  emit(event: string, ...args: any[]) {
    (this.events[event] || []).forEach((i) => i(...args));
  }

  on(event: string, cb: Function): UnbindEventListener {
    (this.events[event] = this.events[event] || []).push(cb);
    let unbind = () =>
      (this.events[event] = (this.events[event] || []).filter((i) => i !== cb));
    return unbind;
  }
}
