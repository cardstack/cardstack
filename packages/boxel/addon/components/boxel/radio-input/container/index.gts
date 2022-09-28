import type { TemplateOnlyComponent } from '@ember/component/template-only';
import cn from '@cardstack/boxel/helpers/cn';
import eq from 'ember-truth-helpers/helpers/eq';

export interface Signature {
  Element: HTMLFieldSetElement;
  Args: {
    disabled?: boolean;
    groupDescription: string;
    spacing: string;
    orientation: string;
  };
  Blocks: {
    'default': [],
  }
}

const RadioInputContainer: TemplateOnlyComponent<Signature> = <template>
  <fieldset class="boxel-radio-fieldset" disabled={{@disabled}} ...attributes>
    <legend class="boxel-radio-fieldset__legend">
      {{@groupDescription}}
    </legend>
    {{!-- this div is necessary because Chrome has a special case for fieldsets and it breaks grid auto placement --}}
    <div class={{cn
        "boxel-radio-fieldset__container"
        boxel-radio-fieldset__container--compact=(eq @spacing "compact")
        boxel-radio-fieldset__container--horizontal=(eq @orientation "horizontal")
        boxel-radio-fieldset__container--vertical=(eq @orientation "vertical")
      }}
    >
      {{yield}}
    </div>
  </fieldset>
</template>

export default RadioInputContainer;
