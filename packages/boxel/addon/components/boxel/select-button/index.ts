import templateOnlyComponent from '@ember/component/template-only';
import { type EmptyObject } from '@ember/component/helper';
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLButtonElement;
  Args: {
    class?: string;
    mode: string;
    isPartial?: boolean;
    isSelected?: boolean;
  };
  Blocks: EmptyObject;
}

export default templateOnlyComponent<Signature>();
