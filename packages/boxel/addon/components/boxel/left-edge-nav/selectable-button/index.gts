import Component from '@glimmer/component';
import cn from '@cardstack/boxel/helpers/cn';
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLButtonElement;
  Args: {
    isSelected: boolean;
  };
  Blocks: {
    default: []
  }
}

export default class SelectableButton extends Component<Signature> {
  <template>
    <button
      class={{cn
        "boxel-left-edge-nav-selectable-button"
        boxel-left-edge-nav-selectable-button--selected=@isSelected
      }}
      ...attributes
    >
      {{yield}}
    </button>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::LeftEdgeNav::SelectableButton': typeof SelectableButton;
  }
}
