import './index.css';
import templateOnlyComponent from '@ember/component/template-only';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    contentClass?: string;
  };
  Blocks: {
    trigger: [];
    content: [{ close: () => void }];
  };
}

const BoxelDropdown = templateOnlyComponent<Signature>();

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Dropdown': typeof BoxelDropdown;
  }
}

export default BoxelDropdown;
