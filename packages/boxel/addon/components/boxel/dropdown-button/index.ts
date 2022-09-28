import templateOnlyComponent from '@ember/component/template-only';
import { type ComponentLike } from '@glint/template';
import BoxelMenu from '../menu';

import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    button?: string;
    class?: string;
    noHoverStyle?: boolean;
    size?: number;
    icon?: string;
    iconSize?: string;
  };
  Blocks: {
    default: [
      {
        Menu: ComponentLike<typeof BoxelMenu>;
        close: () => void;
      }
    ];
  };
}

export default templateOnlyComponent<Signature>();
