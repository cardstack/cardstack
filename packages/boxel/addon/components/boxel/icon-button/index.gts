import type { TemplateOnlyComponent } from '@ember/component/template-only';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import or from 'ember-truth-helpers/helpers/or';
import { concat } from '@ember/helper';
import cn from '@cardstack/boxel/helpers/cn';

import '@cardstack/boxel/styles/global.css';
import './index.css';

export interface Signature {
  Element: HTMLButtonElement;
  Args: {
    variant?: string;
    class?: string;
    icon?: string;
    width?: string;
    height?: string;
  };
  Blocks: {
    default: [];
  };
}

const IconButton: TemplateOnlyComponent<Signature> = <template>
  <button class={{cn
    "boxel-icon-button"
    (if @variant (concat "boxel-icon-button--" @variant))
    @class
  }} ...attributes>
    {{#if @icon}}
      {{svgJar @icon width=(or @width "16px") height=(or @height "16px")}}
    {{/if}}
  </button>
</template>

export default IconButton;

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::IconButton': typeof IconButton;
  }
}
