import '@glint/environment-ember-loose';
import '@cardstack/boxel/glint';
import '@cardstack/ember-shared/glint';
import type cn from '@cardstack/boxel/helpers/cn';
import type cssVar from '@cardstack/boxel/helpers/css-var';
import menuItem from '@cardstack/boxel/helpers/menu-item';
import { type svgJar } from '@cardstack/boxel/utils/svg-jar';
import arrayJoin from '@cardstack/safe-tools-client/helpers/array-join';
import { MetaMaskInpageProvider } from '@metamask/providers';
import link from 'ember-link/helpers/link';
import AndHelper from 'ember-truth-helpers/helpers/and';
import EqHelper from 'ember-truth-helpers/helpers/eq';
import LteHelper from 'ember-truth-helpers/helpers/lte';
import NotHelper from 'ember-truth-helpers/helpers/not';
import OrHelper from 'ember-truth-helpers/helpers/or';

declare module '@glint/environment-ember-loose/registry' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export default interface Registry {
    cn: typeof cn;
    'css-var': typeof cssVar;
    link: typeof link;
    'menu-item': typeof menuItem;
    and: typeof AndHelper;
    not: typeof NotHelper;
    eq: typeof EqHelper;
    or: typeof OrHelper;
    'page-title': HelperLike<{
      Args: { Positional: [title: string] };
      Return: void;
    }>;
    set: HelperLike<{
      Args: { Positional: [] };
      Return: () => void;
    }>;
    'svg-jar': typeof svgJar;
    lte: typeof LteHelper;
    'array-join': typeof arrayJoin;
  }
}

declare global {
  interface Window {
    ethereum?: MetaMaskInpageProvider;
  }
}
