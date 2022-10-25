import type { TemplateOnlyComponent } from '@ember/component/template-only';
import cn from '@cardstack/boxel/helpers/cn';
import element from 'ember-element-helper/helpers/element';
import eq from 'ember-truth-helpers/helpers/eq';
import not from 'ember-truth-helpers/helpers/not';
import or from 'ember-truth-helpers/helpers/or';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';

import '@cardstack/boxel/styles/global.css';
import './index.css';

export interface Signature {
  Element: HTMLElement;
  Args: {
    tag?: keyof HTMLElementTagNameMap;
    centeredDisplay?: boolean;
    fieldId?: string;
    label: string;
    horizontalLabelSize?: string;
    icon?: string;
    vertical?: boolean;
  };
  Blocks: {
    'default': [],
  }
}

const DIV: keyof HTMLElementTagNameMap = "div";
const BoxelField: TemplateOnlyComponent<Signature> = <template>
  
  {{#let (or @tag DIV) as |tag|}}
    {{#let (element tag) as |Tag|}}
      {{! @glint-expect-error couldn't quite figure out how to type ember-element-helper properly }}
      <Tag
        class={{cn "boxel-field"
          boxel-field--vertical=(or @vertical @centeredDisplay)
          boxel-field--horizontal=(not (or @vertical @centeredDisplay))
          boxel-field--small-label=(eq @horizontalLabelSize "small")
          boxel-field--centered-display=@centeredDisplay
        }}
        data-test-boxel-field
        data-test-boxel-field-id={{@fieldId}}
        ...attributes
      >
        <div class="boxel-field__label" data-test-boxel-field-label>
          <span>{{@label}}</span>
        </div>

        {{#if @icon}}
          <div class="boxel-field--with-icon">
            {{svgJar @icon class="boxel-field__icon" role="presentation"}}
            <div class="boxel-field__yield--with-icon">
              {{yield}}
            </div>
          </div>
        {{else}}
          {{yield}}
        {{/if}}
      </Tag>
    {{/let}}
  {{/let}}
</template>

export default BoxelField;