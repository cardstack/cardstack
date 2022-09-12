import templateOnlyComponent from '@ember/component/template-only';
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLButtonElement;
  Args: {
    variant?: string;
    class?: string;
    icon?: string;
    width?: string;
    height?: string;
  };
  Blocks: {
    default: [];
  };
}

const IconButton = templateOnlyComponent<Signature>();

export default IconButton;

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::IconButton': typeof IconButton;
  }
}
