import '@glint/environment-ember-loose';
import '@cardstack/boxel/glint';
import '@cardstack/ember-shared/glint';
import type cssVar from '@cardstack/boxel/helpers/css-var';
import menuItem from '@cardstack/boxel/helpers/menu-item';
import { type svgJar } from '@cardstack/boxel/utils/svg-jar';
import { MetaMaskInpageProvider } from '@metamask/providers';
import link from 'ember-link/helpers/link';
import AndHelper from 'ember-truth-helpers/helpers/and';
import NotHelper from 'ember-truth-helpers/helpers/not';

declare module '@glint/environment-ember-loose/registry' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export default interface Registry {
    'css-var': typeof cssVar;
    link: typeof link;
    'menu-item': typeof menuItem;
    and: typeof AndHelper;
    not: typeof NotHelper;
    'page-title': HelperLike<{
      Args: { Positional: [title: string] };
      Return: void;
    }>;
    set: HelperLike<{
      Args: { Positional: [] };
      Return: () => void;
    }>;
    'svg-jar': typeof svgJar;
  }
}

declare global {
  interface Window {
    ethereum?: MetaMaskInpageProvider;
  }
}
