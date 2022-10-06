import Component from '@glimmer/component';
import { type EmptyObject } from '@ember/component/helper';
import cn from '@cardstack/boxel/helpers/cn';
import cssUrl from "@cardstack/boxel/helpers/css-url";
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLElement;
  Args: {
    iconURL?: string;
    title: string;
    subtitle?: string;
  };
  Blocks: EmptyObject
}

export default class BoxelOrgTitle extends Component<Signature> {
  <template>
    <header class={{cn
      "boxel-org-title"
      boxel-org-title--has-logo=@iconURL
      boxel-org-title--has-subtitle=@subtitle
    }} ...attributes>
      {{#if @iconURL}}
        <span class="boxel-org-title__logo" style={{cssUrl "background-image" @iconURL}} />
      {{/if}}
      <h1 class="boxel-org-title__title">
        {{@title}}
      </h1>
      {{#if @subtitle}}
        <h2 class="boxel-org-title__subtitle">
          {{@subtitle}}
        </h2>
      {{/if}}
    </header>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::OrgTitle': typeof BoxelOrgTitle;
  }
}
