/**
 * Vendored from https://github.com/nag5000/ember-tippy/blob/master/addon/modifiers/tippy.js
 * So that we can apply modifications globally, easily
 */
import Modifier from 'ember-modifier';
import { isHTMLSafe } from '@ember/template';

import tippy, { Instance as TippyInstance, Placement } from 'tippy.js';
import type { Props as TippyOptions } from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/themes/light-border.css';
import '@cardstack/web-client/css/tippy.css';
import { registerDestructor } from '@ember/destroyable';

const baseTippyOptions = {
  theme: 'light-border',
  placement: 'bottom-start' as Placement,
  arrow: false,
  maxWidth: 280,
  offset: [0, 0] as [number, number],
};

type ModifierOptions = Partial<TippyOptions>;

export default class TippyModifier extends Modifier<{
  Args: {
    Positional: [string] | [];
    Named: any;
  };
}> {
  didSetup = false;
  _instances: TippyInstance[] = [];
  targetElement?: HTMLElement;
  options?: ModifierOptions;

  constructor(owner: unknown, args: any) {
    super(owner, args);
    registerDestructor(this, this.cleanup);
  }

  modify(element: HTMLElement, positional: [string], named: any) {
    this.targetElement = element;
    const optionsHash: ModifierOptions = named.options || named;
    this.options = {
      content: positional?.[0],
      ...baseTippyOptions,
      ...optionsHash,
    };
    let tippyConfig = this.parseOptions(this.options);
    const { tippyTargets, tippyOptions } = tippyConfig;
    if (!this.didSetup) {
      // NOTE: tippy() returns a single instance or an array of instances,
      // depending on the type of targets argument.
      // https://atomiks.github.io/tippyjs/v6/tippy-instance/#accessing-an-instance
      const instances = tippy(tippyTargets, tippyOptions);
      this._instances = ([] as TippyInstance[]).concat(instances);
      this.didSetup = true;
    } else {
      let tippyConfig = this.parseOptions(this.options);
      this._instances.forEach((x) => x.setProps(tippyConfig.tippyOptions));
    }
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
      tippyTargets: this.targetElement!,
      tippyOptions,
    };
  }

  cleanup(destroyable: TippyModifier) {
    destroyable._instances.forEach((x) => x.destroy());
    destroyable._instances = [];
  }
}
