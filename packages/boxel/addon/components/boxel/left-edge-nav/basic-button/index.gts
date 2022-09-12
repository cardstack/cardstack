import Component from '@glimmer/component';
import { EmptyObject } from '@ember/component/helper';
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLButtonElement;
  Args: EmptyObject;
  Blocks: {
    default: []
  }
}

export default class BoxelLeftEdgeNavBasicButton extends Component<Signature> {
  <template>
    <button
      class="boxel-left-edge-nav-basic-button"
      data-test-left-edge-nav-home-button
      ...attributes
    >
      {{yield}}
    </button>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::LeftEdgeNav::BasicButton': typeof BoxelLeftEdgeNavBasicButton;
  }
}
