import Ember from 'ember';
import 'ember-concurrency-async';
import 'ember-concurrency-ts/async';
declare global {
  interface Array<T> extends Ember.ArrayPrototypeExtensions<T> {}
  // interface Function extends Ember.FunctionPrototypeExtensions {}
}

export {};
