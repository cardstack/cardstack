import { helper } from '@ember/component/helper';
import classnames from 'classnames';

export default helper(
  /**
   * Wrapper for classnames, which creates a string of classes that concatenates all positional arguments + named arguments with truthy values
   *
   * @returns A string of classes
   */
  function classNames(
    params: (string | undefined)[],
    hash: Record<string, string | boolean | undefined>
  ): string {
    // Change NamedArgsProxy -> Javascript object for compatibility with classnames@2.3.x
    const entries = Object.entries(hash);
    const obj = Object.fromEntries(entries);

    return classnames(...params, obj);
  }
);
