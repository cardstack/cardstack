import templateOnlyComponent from '@ember/component/template-only';
import '@cardstack/boxel/styles/global.css';
import './index.css';
import { type EmptyObject } from '@ember/component/helper';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    label?: string;
    id?: string;
    value: string;
    onInput?: (e: InputEvent) => void;
    onChange?: (e: InputEvent) => void;
    disabled?: boolean;
    hideIcon?: boolean;
    placeholder?: string;
  };
  Blocks: EmptyObject;
}
const Searchbox = templateOnlyComponent<Signature>();
export default Searchbox;

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Searchbox': typeof Searchbox;
  }
}
