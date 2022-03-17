// based on https://github.com/ai/nanoevents/blob/main/index.js
export type UnbindEventListener = () => void;

export interface Emitter<EmitterEvent = string> {
  on(event: EmitterEvent, cb: Function): UnbindEventListener;
}

/**
 * Minimal example of an event emitter in a service that can be listened to by the `Listener` component.
 * This service checks for the dimensions of an element '.target' and emits them when the window is resized
 *
 * 1. Service that listens for events and emits them:
 * ```
 * import {
 *   SimpleEmitter,
 *   UnbindEventListener,
 * } from '@cardstack/ssr-web/utils/events';
 * import Service from '@ember/service';
 *
 * export default class ResizedTarget extends Service {
 *   simpleEmitter = new SimpleEmitter();
 *
 *   constructor(props: object | undefined) {
 *     super(props);
 *     // code to emit an event with some dimensions of a target when
 *     // the window is resized
 *     window.addEventListener('resize', () => {
 *       let data = document.querySelector('.target')?.getBoundingClientRect();
 *       this.simpleEmitter.emit('resized', data);
 *     });
 *   }
 *
 *   // Add an on method to comply with the Emitter interface
 *   // return a method that unbinds the event listener
 *   on(event: string, cb: Function): UnbindEventListener {
 *     return this.simpleEmitter.on(event, cb);
 *   }
 * }
 *
 * // DO NOT DELETE: this is how TypeScript knows how to look up your services.
 * declare module '@ember/service' {
 *   interface Registry {
 *     'resized-target': ResizedTarget;
 *   }
 * }
 *
 * ```
 *
 * 2. Listener component used in a template file (needs an import of the resizedTargetService to the corresponding component file):
 * ```
 * <Listener
 *    @emitter={{this.resizedTargetService}}
 *    @event="resized"
 *    @action={{this.onResize}}
 *  />
 *  <div class="target" style="width: 100%;"></div>
 * ```
 *
 */

export class SimpleEmitter {
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
