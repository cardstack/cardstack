import Ember from 'ember';

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Array<T> extends Ember.ArrayPrototypeExtensions<T> {}
  // interface Function extends Ember.FunctionPrototypeExtensions {}
}

export {};
