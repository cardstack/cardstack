import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import type { TemplateOnlyComponent } from '@ember/component/template-only';
import or from 'ember-truth-helpers/helpers/or';
import cssVar from '@cardstack/boxel/helpers/css-var';
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    color?: string;
  };
  Blocks: {
  }
}

const LoadingIndicator: TemplateOnlyComponent<Signature> = <template>
  <div class="boxel-loading-indicator" ...attributes>
    {{svgJar "loading-indicator" style=(cssVar icon-color=(or @color "#000")) role="presentation"}}
  </div>
</template>

export default LoadingIndicator;

