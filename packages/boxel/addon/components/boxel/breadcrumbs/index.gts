import Component from '@glimmer/component';
import eq from 'ember-truth-helpers/helpers/eq';
import { LinkTo } from '@ember/routing';
import forceArray from '@cardstack/boxel/helpers/force-array';

import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Breadcrumb {
  route: string;
  routeModel: string|string[];
  title: string;
  type: string;
}

interface Signature {
  Element: HTMLDivElement;
  Args: {
    class?: string;
    items?: Breadcrumb[];
  };
  Blocks: {
    default: []
  }
}

export default class Breadcrumbs extends Component<Signature> {

  <template>
    <<div class="boxel-breadcrumbs {{@class}}" ...attributes>
    {{#if @items}}
      {{#each @items as |item i|}}
        {{#if (eq i 0)}}
          <LinkTo @route={{item.route}} @models={{forceArray item.routeModel}} class="boxel-breadcrumbs__item">
            <div class="boxel-breadcrumbs__item-label">{{item.type}}</div>
            <div class="boxel-breadcrumbs__item-title">{{item.title}}</div>
          </LinkTo>
        {{else}}
          <span class="boxel-breadcrumbs__caret" />
          <LinkTo @route={{item.route}} @models={{forceArray item.routeModel}} class="boxel-breadcrumbs__item">
            <div class="boxel-breadcrumbs__item-label">{{item.type}}</div>
            <div class="boxel-breadcrumbs__item-title">{{item.title}}</div>
          </LinkTo>
        {{/if}}
      {{/each}}
    {{else}}
      {{yield}}
    {{/if}}
  </div>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Breadcrumbs': typeof Breadcrumbs;
  }
}
