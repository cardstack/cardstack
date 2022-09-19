// Needed because `yarn prepack` was not recognising assert.dom
// and this fix caused other typing problems:
// https://github.com/simplabs/qunit-dom#typescript
// import 'qunit-dom';

import '@glint/environment-ember-loose';

import AndHelper from 'ember-truth-helpers/helpers/and';
import EqHelper from 'ember-truth-helpers/helpers/eq';
import OrHelper from 'ember-truth-helpers/helpers/or';
import NotHelper from 'ember-truth-helpers/helpers/not';
import GtHelper from 'ember-truth-helpers/helpers/gt';
import OptionalHelper from 'ember-composable-helpers/helpers/optional';
import { ComponentLike, HelperLike } from '@glint/template';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import cssUrl from '@cardstack/boxel/helpers/css-url';
import cssVar from '@cardstack/boxel/helpers/css-var';
import { type EmptyObject } from '@ember/component/helper';
import AddHelper from 'ember-math-helpers/helpers/add';
import { PowerSelectArgs } from 'ember-power-select/addon/components/power-select';

interface PatchedPowerSelectArgs extends PowerSelectArgs {
  dropdownClass?: string;
  placeholder?: string;
  renderInPlace?: boolean;
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    add: typeof AddHelper;
    and: typeof AndHelper;
    eq: typeof EqHelper;
    or: typeof OrHelper;
    not: typeof NotHelper;
    gt: typeof GtHelper;
    optional: typeof OptionalHelper;
    cn: HelperLike<{
      Args: {
        Positional: string[];
        Named: Record<string, string | boolean | undefined>;
      };
      Return: string;
    }>;
    'css-url': typeof cssUrl;
    'css-var': typeof cssVar;
    'html-safe': HelperLike<{
      Args: { Positional: string[] };
      Return: string;
    }>;
    noop: HelperLike<{
      Args: { Positional: string[] };
      Return: void;
    }>;
    'on-key': HelperLike<{
      Args: {
        Positional: [keyCombo: string, callback: () => void];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Named: { event: any };
      };
      Return: void;
    }>;
    'set-body-class': HelperLike<{
      Args: { Positional: string[] };
      Return: void;
    }>;
    'svg-jar': typeof svgJar;
    'unique-id': HelperLike<{ Args: EmptyObject; Return: string }>;
    PowerSelect: ComponentLike<{
      Element: HTMLDivElement;
      Args: PatchedPowerSelectArgs;
      // TODO: figure out property types for default block
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Blocks: { default: [any, any] };
    }>;
    'Freestyle::Usage': ComponentLike<{
      Element: HTMLDivElement;
      Args: {
        name?: string;
        description?: string;
        slug?: string;
      };
      Blocks: {
        example: [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        api: [Args: any];
        description: [];
      };
    }>;
  }
}
