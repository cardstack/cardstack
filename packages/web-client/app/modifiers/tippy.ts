/**
 * Vendored from https://github.com/nag5000/ember-tippy/blob/master/addon/modifiers/tippy.js
 * So that we can apply modifications globally, easily
 */
import Modifier from 'ember-modifier';
import { isHTMLSafe } from '@ember/template';

import tippy, { Instance as TippyInstance } from 'tippy.js';
import type { Props as TippyOptions } from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/themes/light-border.css';

const baseTippyOptions = {
  theme: 'light-border',
  placement: 'bottom',
  arrow: false,
  maxWidth: 280,
};

type ModifierOptions = Partial<TippyOptions>;

export default class TippyModifier extends Modifier<{
  positional: [string] | [];
  named: any;
}> {
  _instances: TippyInstance[] = [];

  get defaultTarget() {
    return this.element;
  }

  get options() {
    const optionsHash: ModifierOptions =
      this.args.named.options || this.args.named;
    return {
      content: this.args.positional?.[0],
      ...baseTippyOptions,
      ...optionsHash,
    };
  }

  parseOptions(options: any) {
    if (options.content instanceof HTMLElement && options.content.hidden) {
      options.content.hidden = false;
    }

    if (options.allowHTML == null && isHTMLSafe(options.content)) {
      options.allowHTML = true;
    }

    const {
      // the rest are tippy options (tippy warns about unknown options)
      ...tippyOptions
    } = options;

    return {
      tippyTargets: this.defaultTarget,
      tippyOptions,
    };
  }

  didInstall() {
    const options = this.parseOptions(this.options);
    const { tippyTargets, tippyOptions } = options;

    // NOTE: tippy() returns a single instance or an array of instances,
    // depending on the type of targets argument.
    // https://atomiks.github.io/tippyjs/v6/tippy-instance/#accessing-an-instance
    const instances = tippy(tippyTargets, tippyOptions);
    this._instances = ([] as TippyInstance[]).concat(instances);
  }

  didUpdateArguments() {
    const options = this.parseOptions(this.options);

    this._instances.forEach((x) => x.setProps(options.tippyOptions));
  }

  willDestroy() {
    this._instances.forEach((x) => x.destroy());
    this._instances = [];
  }
}
