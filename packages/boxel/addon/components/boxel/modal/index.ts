import templateOnlyComponent from '@ember/component/template-only';
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLElement;
  Args: {
    imgURL?: string;
    size?: 'small' | 'medium' | 'large';
    layer?: 'urgent';
    isOpen?: boolean;
    onClose: () => void;
  };
  Blocks: {
    default: [];
  };
}

const Modal = templateOnlyComponent<Signature>();
export default Modal;

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Modal': typeof Modal;
  }
}
