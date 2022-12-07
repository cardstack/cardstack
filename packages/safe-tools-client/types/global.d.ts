import '@glint/environment-ember-loose';
import '@cardstack/boxel/glint';
import { MetaMaskInpageProvider } from '@metamask/providers';

declare module '@glint/environment-ember-loose/registry' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export default interface Registry {}
}

declare global {
  interface Window {
    ethereum?: MetaMaskInpageProvider;
  }
}
