import Component from '@glimmer/component';
import { type EmptyObject } from '@ember/component/helper';
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLDivElement;
  Args: EmptyObject;
  Blocks: {
    default: [];
  }
}

export default class CardDropPageLayout extends Component<Signature> {
  <template>
    <div class='card-drop-page-page-layout' ...attributes>
      {{yield}}
    </div>
      </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'CardDropPage::Layout': typeof CardDropPageLayout;
  }
}
