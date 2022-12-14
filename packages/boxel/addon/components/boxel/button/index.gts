import Component from '@glimmer/component';
import '@cardstack/boxel/styles/global.css';
import './index.css';
import cn from '@cardstack/boxel/helpers/cn';

import { array, concat, hash } from '@ember/helper';
import or from 'ember-truth-helpers/helpers/or';
import eq from 'ember-truth-helpers/helpers/eq';
import not from 'ember-truth-helpers/helpers/not';
import LoadingIndicator from '../loading-indicator';
import { LinkTo } from '@ember/routing';

interface Signature {
  Element: HTMLButtonElement | HTMLAnchorElement;
  Args: {
    as?: string;
    kind?: string;
    disabled?: boolean;
    loading?: boolean;
    route?: any;
    models?: any;
    query?: any;
    size?: string;
    href?: string;
    class?: string;
  };
  Blocks: {
    'default': [],
  }
}
export default class ButtonComponent extends Component<Signature> {
  defaultSize = 'base';
  defaultKind = 'secondary-light';

  <template>
    {{#let (cn
      "boxel-button"
      @class
      (concat "boxel-button--size-" (or @size this.defaultSize))
      (concat "boxel-button--kind-" (or @kind this.defaultKind))
    ) as |classes|}}
      {{#if (or (not @as) (eq @as "button"))}}
        <button
          class={{cn classes (if @loading "boxel-button--loading")}}
          tabindex={{if @loading -1 0}}
          disabled={{@disabled}}
          data-test-boxel-button
          ...attributes
        >
        {{#if @loading}}
          <LoadingIndicator class="boxel-button__loading-indicator" @color="var(--boxel-button-text-color)" data-test-boxel-button-loading-indicator />
        {{/if}}
          {{yield}}
        </button>
      {{else if (eq @as "anchor")}}
        <a
          class={{classes}}
          href={{unless @disabled @href}}
          data-test-boxel-button 
          ...attributes
        >
          {{yield}}
        </a>
      {{else if (eq @as "link-to")}}
        <LinkTo
          class={{classes}}
          @route={{@route}}
          @models={{if @models @models (array)}}
          @query={{or @query (hash)}}
          @disabled={{@disabled}}
          data-test-boxel-button 
          tabindex={{if @disabled -1 0}}
          ...attributes
        >
          {{yield}}
        </LinkTo>
      {{/if}}
    {{/let}}
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Button': typeof ButtonComponent;
  }
}
