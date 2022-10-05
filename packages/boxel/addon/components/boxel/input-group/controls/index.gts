import type { TemplateOnlyComponent } from '@ember/component/template-only';
import { type EmptyObject } from '@ember/component/helper';
import { ComponentLike } from '@glint/template';
import pick from 'ember-composable-helpers/helpers/pick';
import { on } from '@ember/modifier';
import optional from 'ember-composable-helpers/helpers/optional';
import or from 'ember-truth-helpers/helpers/or';

interface InputControlSignature {
  Element: HTMLSpanElement;
  Args: {
    disabled?: boolean;
    readonly?: boolean;
    required?: boolean;
    placeholder?: string;
    value?: string;
    onInput?: (val: string) => void;
    onBlur?: (ev: Event) => void;
  };
  Blocks: EmptyObject;
}

export const InputControl: TemplateOnlyComponent<InputControlSignature> = <template>
  <input
    class="boxel-input-group__form-control"
    placeholder={{@placeholder}}
    value={{@value}}
    disabled={{@disabled}}
    readonly={{@readonly}}
    required={{@required}}
    {{on "input" (pick "target.value" (optional @onInput))}}
    {{on "blur" (optional @onBlur)}}
    ...attributes
  />
</template>

interface TextareaControlSignature {
  Element: HTMLSpanElement;
  Args: {
    placeholder?: string;
    value?: string;
  };
  Blocks: EmptyObject;
}

export const TextareaControl: TemplateOnlyComponent<TextareaControlSignature> = <template>
  <textarea class="boxel-input-group__form-control" ...attributes></textarea>
</template>

export interface ControlsBlockArg {
  Input: ComponentLike<InputControlSignature>;
  Textarea: ComponentLike<TextareaControlSignature>;
}
