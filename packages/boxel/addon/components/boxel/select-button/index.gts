import type { TemplateOnlyComponent } from '@ember/component/template-only';
import { type EmptyObject } from '@ember/component/helper';
import cn from '@cardstack/boxel/helpers/cn';
import { concat } from '@ember/helper';
import and from 'ember-truth-helpers/helpers/and';
import not from 'ember-truth-helpers/helpers/not';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';

import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLButtonElement;
  Args: {
    class?: string;
    mode: string;
    isPartial?: boolean;
    isSelected?: boolean;
  };
  Blocks: EmptyObject;
}

const SelectButton: TemplateOnlyComponent<Signature> = <template>
  <button
    class={{cn
      "boxel-select-button"
      @class
      (concat "boxel-select-button--" @mode)
      boxel-select-button--partial=(and @isPartial (not @isSelected))
      boxel-select-button--selected=@isSelected
    }}
    aria-label={{if @isSelected "selected" "select"}}
    data-test-boxel-select-button
    ...attributes
  >
    {{svgJar "icon-circle-selected" width="16" height="16"}}
  </button>
</template>

export default SelectButton;