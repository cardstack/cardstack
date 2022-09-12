import type { TemplateOnlyComponent } from '@ember/component/template-only';
import '@cardstack/boxel/styles/global.css';
import './index.css';
import { type EmptyObject } from '@ember/component/helper';
import cn from '@cardstack/boxel/helpers/cn';

import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import { concat } from '@ember/helper';
import eq from 'ember-truth-helpers/helpers/eq';
import not from 'ember-truth-helpers/helpers/not';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    state: string|null;
    icon: string;
    title: string;
    description: string;
  };
  Blocks: EmptyObject;
}

const CardCatalogTrayItem: TemplateOnlyComponent<Signature> = <template>
  <div
    class={{cn
      "boxel-card-catalog-tray-item"
      (concat "boxel-card-catalog-tray-item--" @state)
    }}
    tabindex="0"
    ...attributes
  >
    {{svgJar @icon class="boxel-card-catalog-tray-item__icon"}}
    <h3 class="boxel-card-catalog-tray-item__title">
      {{@title}}
    </h3>
    <p class="boxel-card-catalog-tray-item__description">
      {{@description}}
    </p>
    {{#if (eq @state "used")}}
      {{svgJar
        "icon-check-circle-ht"
        class="boxel-card-catalog-tray-item__used-icon"
      }}
    {{else if (not (eq @state "dragged-in-tray"))}}
      {{svgJar "gripper" class="boxel-card-catalog-tray-item__drag-handle"}}
    {{/if}}
  </div>
</template>

export default CardCatalogTrayItem;

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::CardCatalogTrayItem': typeof CardCatalogTrayItem;
  }
}