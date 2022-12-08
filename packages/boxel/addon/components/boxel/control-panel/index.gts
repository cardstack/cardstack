import Component from '@glimmer/component';
import type { TemplateOnlyComponent } from '@ember/component/template-only';
import { hash } from '@ember/helper';
import cn from '@cardstack/boxel/helpers/cn';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';

import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLElement;
  Args: {
  };
  Blocks: {
    default: [{ Item: typeof Item }],
  };
}

interface ItemSignature {
  Element: HTMLElement
  Args: {
    icon: string;
    isActive?: boolean;
    title: string;
  },
  Blocks: {
    default: [],
  }
}

const Item: TemplateOnlyComponent<ItemSignature> =
<template>
  <section class="boxel-control-panel__item">
    <heading
      class={{
        cn
        "boxel-control-panel__item-heading"
        boxel-control-panel__item-heading--is-active=@isActive
      }}>
      {{svgJar
        @icon
        width="18px"
        height="18px"
        class="boxel-control-panel__item-icon"
      }}
      {{@title}}
    </heading>
    <div class="boxel-control-panel__item-body">
      {{yield}}
    </div>
  </section>
</template>;

export default class ControlPanel extends Component<Signature> {

  <template>
    <div class="boxel-control-panel">
      {{yield (hash Item=Item)}}
    </div>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::ControlPanel': typeof ControlPanel;
  }
}
