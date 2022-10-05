import type { TemplateOnlyComponent } from '@ember/component/template-only';
import BoxelIconButton from '../../icon-button';
import BoxelButton from '../../button';
import BoxelSelect, { BoxelSelectArgs } from '../../select';
import { type EmptyObject } from '@ember/component/helper';
import { ComponentLike } from '@glint/template';

interface ButtonAccessorySignature {
  Element: HTMLButtonElement | HTMLAnchorElement;
  Args: {
    kind?: string;
  };
  Blocks: {
    default: [];
  }
}

export const ButtonAccessory: TemplateOnlyComponent<ButtonAccessorySignature> = <template>
  <BoxelButton
    class="boxel-input-group__accessory boxel-input-group__button-accessory"
    @kind={{@kind}}
    data-test-boxel-input-group-button-accessory
    ...attributes
  >
    {{yield}}
  </BoxelButton>
</template>

interface IconButtonAccessorySignature {
  Element: HTMLButtonElement;
  Args: {
    icon: string;
  };
  Blocks: {
    default: [];
  }
}

export const IconButtonAccessory: TemplateOnlyComponent<IconButtonAccessorySignature> = <template>
  <BoxelIconButton
    class="boxel-input-group__accessory boxel-input-group__button-accessory"
    @icon={{@icon}}
    data-test-boxel-input-group-icon-button-accessory
    ...attributes
  />
</template>

interface TextAccessorySignature {
  Element: HTMLSpanElement;
  Args: EmptyObject;
  Blocks: { default: []; };
}

export const TextAccessory: TemplateOnlyComponent<TextAccessorySignature> = <template>
  <span
    class="boxel-input-group__accessory boxel-input-group__text-accessory"
    data-test-boxel-input-group-text-accessory
    ...attributes
  >{{yield}}</span>
</template>

interface SelectAccessorySignature<ItemT = any> {
  Element: HTMLDivElement;
  Args: BoxelSelectArgs<ItemT>;
  Blocks: {
    default: [ItemT, string];
  };
}

export const SelectAccessory: TemplateOnlyComponent<SelectAccessorySignature> = <template>
  <div class="boxel-input-group__accessory boxel-input-group__select-accessory" data-test-boxel-input-group-select-accessory>
    <BoxelSelect
      @disabled={{@disabled}}
      @dropdownClass={{@dropdownClass}}
      @placeholder={{@placeholder}}
      @options={{@options}}
      @selected={{@selected}}
      @onChange={{@onChange}}
      data-test-boxel-input-group-select-accessory-trigger
      ...attributes
    as |item itemCssClass|>
      {{#if (has-block)}}
        {{yield item itemCssClass}}
      {{else}}
        <div class={{itemCssClass}}>{{item}}</div>
      {{/if}}
    </BoxelSelect>
  </div>
</template>

export interface AccessoriesBlockArg {
  Button: ComponentLike<ButtonAccessorySignature>;
  IconButton: ComponentLike<IconButtonAccessorySignature>;
  Text: ComponentLike<TextAccessorySignature>;
  Select: ComponentLike<SelectAccessorySignature>;
}
