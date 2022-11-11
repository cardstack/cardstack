import type { TemplateOnlyComponent } from '@ember/component/template-only';
import { type EmptyObject } from '@ember/component/helper';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';

import '@cardstack/boxel/styles/global.css';
import './index.css';

export interface Signature {
  Element: HTMLDivElement;
  Args: {
    title?: string;
    description: string;
  };
  Blocks: EmptyObject;
}

const Infobox: TemplateOnlyComponent<Signature> = <template>
  <div class="boxel-infobox" ...attributes>
    <div class="boxel-infobox__text-container">
      <h2 class="boxel-infobox__title">{{@title}}</h2>
      <p class="boxel-infobox__description">{{@description}}</p>
    </div>
    <button
      class="boxel-infobox__close-button"
      type="button"
      aria-label="Close"
    >
      {{svgJar "close" width="100%" height="100%" aria-hidden="true"}}
    </button>
  </div>
</template>

export default Infobox;