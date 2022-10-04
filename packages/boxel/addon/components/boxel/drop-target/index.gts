import type { TemplateOnlyComponent } from '@ember/component/template-only';
import { type EmptyObject } from '@ember/component/helper';
import cn from '@cardstack/boxel/helpers/cn';
import { concat } from '@ember/helper';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';

import '@cardstack/boxel/styles/global.css';
import './index.css';

export interface Signature {
  Element: HTMLDivElement;
  Args: {
    state?: string;
  };
  Blocks: EmptyObject;
}

const DropTarget: TemplateOnlyComponent<Signature> = <template>
  <div
    class={{cn
      "boxel-drop-target"
      (concat "boxel-drop-target--" @state)
    }}
    ...attributes
  >
    {{svgJar "icon-plus-circle-highlight-bg" width="30" height="30"}}
    <span class="boxel-drop-target__cta">
      Drag and drop from the card catalog
    </span>
  </div>
</template>

export default DropTarget;