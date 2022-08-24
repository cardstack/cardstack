import templateOnlyComponent from '@ember/component/template-only';
import '@cardstack/boxel/styles/global.css';
import './index.css';
import { EmptyObject } from '@ember/component/helper';

interface Signature {
  Element: HTMLDivElement;
  Args: EmptyObject;
  Blocks: {
    default: [];
  };
}

const DarkThemeAndLightTheme = templateOnlyComponent<Signature>();
export default DarkThemeAndLightTheme;

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Doc::DarkThemeAndLightTheme': typeof DarkThemeAndLightTheme;
  }
}
