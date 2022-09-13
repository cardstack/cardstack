import '@glint/environment-ember-loose';
import '@cardstack/boxel/glint';

// prettier-ignore
import { ComponentLike, HelperLike } from '@glint/template';
import AndHelper from 'ember-truth-helpers/helpers/and';
import EqHelper from 'ember-truth-helpers/helpers/eq';
import OrHelper from 'ember-truth-helpers/helpers/or';
import NotHelper from 'ember-truth-helpers/helpers/not';
import GtHelper from 'ember-truth-helpers/helpers/gt';
import type cn from '@cardstack/boxel/helpers/cn';
import type cssUrl from '@cardstack/boxel/helpers/css-url';
import type cssVar from '@cardstack/boxel/helpers/css-var';
import type onClickOutside from '@cardstack/web-client/modifiers/on-click-outside';
import { type svgJar } from '@cardstack/boxel/utils/svg-jar';
import type toggle from 'ember-composable-helpers/helpers/toggle';

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    and: typeof AndHelper;
    eq: typeof EqHelper;
    or: typeof OrHelper;
    not: typeof NotHelper;
    gt: typeof GtHelper;
    cn: typeof cn;
    'css-url': typeof cssUrl;
    'css-var': typeof cssVar;
    'on-click-outside': typeof onClickOutside;
    'page-title': HelperLike<{
      Args: { Positional: [title: string] };
      Return: void;
    }>;
    'svg-jar': typeof svgJar;
    toggle: typeof toggle;

    ToElsewhere: ComponentLike<{
      Args: {
        named: string;
        send: ComponentLike;
      };
    }>;
  }
}
