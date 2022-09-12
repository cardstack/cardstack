import Component from '@glimmer/component';
import { type EmptyObject } from '@ember/component/helper';
import cn from '@cardstack/boxel/helpers/cn';
import cssUrl from "@cardstack/boxel/helpers/css-url";
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLHeadingElement;
  Args: {
    iconURL?: string;
    title: string;
  };
  Blocks: EmptyObject
}

export default class BoxelOrgTitle extends Component<Signature> {
  <template>
    <h1
      class={{cn
        "boxel-org-title"
        boxel-org-title--has-logo=@iconURL
      }}
      ...attributes
    >
      {{#if @iconURL}}
        <span class="boxel-org-title__logo" style={{cssUrl "background-image" @iconURL}} />
      {{/if}}
      {{@title}}
    </h1>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::OrgTitle': typeof BoxelOrgTitle;
  }
}
