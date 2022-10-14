import type { TemplateOnlyComponent } from '@ember/component/template-only';
import cn from '@cardstack/boxel/helpers/cn';
import cssUrl from "@cardstack/boxel/helpers/css-url";
import or from 'ember-truth-helpers/helpers/or';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';

import '@cardstack/boxel/styles/global.css';
import './index.css';


export interface Signature {
  Element: HTMLElement;
  Args: {
    dataTestId?: string;
    title?: string;
    icon?: string;
    imgUrl?: string;
  };
  Blocks: {
    'default': [],
  }
}

const ActionContainerSectionTitle: TemplateOnlyComponent<Signature> = <template>
  <header
    class={{cn "boxel-action-container-section-title" boxel-action-container-section-title--flex=(or @icon @imgUrl)}}
    data-test-action-container-section-title={{@dataTestId}}
    ...attributes
  >
    {{#if @icon}}
      {{svgJar @icon class="boxel-action-container-section-title--icon" width="20" height="20"}}
    {{/if}}

    <div class="boxel-action-container-section-title--content">
      {{yield}}
    </div>

    {{#if @imgUrl}}
      <span style={{cssUrl "background-image" @imgUrl}} class="boxel-action-container-section-title--img" />
    {{/if}}
  </header>
</template>

export default ActionContainerSectionTitle