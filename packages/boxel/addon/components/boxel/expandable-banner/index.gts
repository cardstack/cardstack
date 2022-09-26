import type { TemplateOnlyComponent } from '@ember/component/template-only';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import '@cardstack/boxel/styles/global.css';
import './index.css';

export interface Signature {
  Element: HTMLDetailsElement;
  Args: {
    icon: string;
    summary: string;
  };
  Blocks: {
    'default': [],
  }
}

const ExpandableBanner: TemplateOnlyComponent<Signature> = <template>
  <details class="boxel-expandable-banner__details" ...attributes>
    <summary class="boxel-expandable-banner__summary">
      <div class="boxel-expandable-banner__summary-layout">
      {{svgJar @icon class="boxel-expandable-banner__summary-icon"}}
      <span class="boxel-expandable-banner__summary-text">
        {{@summary}}
      </span>
      <div class="boxel-expandable-banner__summary-marker" aria-hidden="true">
        {{svgJar "caret-up" class="boxel-expandable-banner__summary-marker-icon"}}
      </div>
      </div>
    </summary>
    <div class="boxel-expandable-banner__details-content">
      {{yield}}
    </div>
  </details>
</template>

export default ExpandableBanner;