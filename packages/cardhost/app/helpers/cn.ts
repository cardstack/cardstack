import { helper } from '@ember/component/helper';
import classnames from 'classnames';

export default helper(
  /**
   * Wrapper for classnames, which creates a string of classes that concatenates all positional arguments + named arguments with truthy values
   *
   * While the arguments generally behave like Javascript objects and arrays, there are some differences - eg. the lack of a `toString` method. For more information, see:
   * - PositionalArgsProxy: https://github.com/glimmerjs/glimmer-vm/blob/09a959a14c3da4875f460ddfe545a80a7af93b04/packages/%40glimmer/manager/lib/util/args-proxy.ts#L102-L133
   * - NamedArgsProxy: https://github.com/glimmerjs/glimmer-vm/blob/09a959a14c3da4875f460ddfe545a80a7af93b04/packages/%40glimmer/manager/lib/util/args-proxy.ts#L61-L100
   *
   * @param {PositionalArgsProxy} params Positional arguments passedto the helper as a proxy that behaves like an array
   * @param {NamedArgsProxy} hash Named arguments passed to the helper as a proxy that behaves like a Javascript object
   *
   * @returns A string of classes
   */
  function classNames(params, hash) {
    // Change NamedArgsProxy -> Javascript object for compatibility with classnames@2.3.x
    const entries = Object.entries(hash);
    const obj = Object.fromEntries(entries);

    return classnames(...params, obj);
  }
);
