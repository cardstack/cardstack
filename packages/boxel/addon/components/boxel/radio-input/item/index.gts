import type { TemplateOnlyComponent } from '@ember/component/template-only';
import cn from '@cardstack/boxel/helpers/cn';
import not from 'ember-truth-helpers/helpers/not';
import { on } from '@ember/modifier';
import optional from 'ember-composable-helpers/helpers/optional';

export interface Signature {
  Element: HTMLLabelElement;
  Args: {
    checked?: boolean;
    disabled?: boolean;
    hideBorder?: boolean;
    hideRadio?: boolean;
    name: string;
    onBlur?: () => void;
    onChange: () => void;
  };
  Blocks: {
    'default': [],
  }
}

const RadioInputItem: TemplateOnlyComponent<Signature> = <template>
  {{!--
  anything that's used as a label does not have its semantics in a screenreader.
  that seems ok, since you probably shouldn't make a form work as document hierarchy.
  aria-labelledby seems friendlier to safari than the for element, but unsure about other browsers.
  --}}
  <label
    class={{cn
      "boxel-radio-option"
      boxel-radio-option--checked=@checked
      boxel-radio-option--disabled=@disabled
      boxel-radio-option--hidden-border=@hideBorder
      boxel-radio-option--has-radio=(not @hideRadio)
    }}
    data-test-boxel-radio-option
    data-test-boxel-radio-option-checked={{@checked}}
    data-test-boxel-radio-option-disabled={{@disabled}}
    ...attributes
  >
    <input
      class={{cn
        "boxel-radio-option__input"
        boxel-radio-option__input--hidden-radio=@hideRadio
        boxel-radio-option__input--checked=@checked
      }}
      type="radio"
      checked={{@checked}}
      disabled={{@disabled}}
      name={{@name}}
      {{on "change" (optional @onChange)}}
      {{on "blur" (optional @onBlur)}}
    />
    <div>
      {{yield}}
    </div>
  </label>
</template>

export default RadioInputItem;
