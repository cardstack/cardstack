import type { TemplateOnlyComponent } from '@ember/component/template-only';
import { type WithBoundArgs } from '@glint/template';
import BoxelDropdown from '../dropdown';
import BoxelMenu from '../menu';
import cn from '@cardstack/boxel/helpers/cn';
import cssVar from '@cardstack/boxel/helpers/css-var';
import or from 'ember-truth-helpers/helpers/or';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';

import { concat, hash } from '@ember/helper';

import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLButtonElement;
  Args: {
    label?: string;
    class?: string;
    noHoverStyle?: boolean;
    size?: number;
    icon?: string;
    iconSize?: number;
  };
  Blocks: {
    default: [
      {
        Menu: WithBoundArgs<typeof BoxelMenu, 'closeMenu'>;
        close: () => void;
      }
    ];
  };
}

const DropdownButton: TemplateOnlyComponent<Signature> = <template>
    <BoxelDropdown>
      <:trigger as |bindings|>
        <button
          {{bindings}}
          class={{cn
            "boxel-dropdown-button"
            "boxel-dropdown-button__reset"
            "boxel-dropdown-button__trigger"
            @class
          }}
          style={{cssVar dropdown-button-size=(concat (or @size 40) "px")}}
          aria-label={{@label}}
          data-test-boxel-dropdown-button
          ...attributes
        >
          {{svgJar
            @icon
            width=(or @iconSize 16)
            height=(or @iconSize 16)
          }}
        </button>
      </:trigger>
      <:content as |dd|>
        {{yield
          (hash Menu=(component BoxelMenu closeMenu=dd.close) close=dd.close)
        }}
      </:content>
    </BoxelDropdown>
</template>

export default DropdownButton;
