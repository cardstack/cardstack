import Component from '@glimmer/component';
import Container from './container';
import Item from './item';
import and from 'ember-truth-helpers/helpers/and';
import eq from 'ember-truth-helpers/helpers/eq';
import or from 'ember-truth-helpers/helpers/or';
//@ts-expect-error glint does not think this is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { concat, hash } from '@ember/helper';
import cn from '@cardstack/boxel/helpers/cn';
import { guidFor } from '@ember/object/internals';

import '@cardstack/boxel/styles/global.css';
import './index.css';

export interface Signature {
  Element: HTMLFieldSetElement;
  Args: {
    checkedId?: string;
    disabled?: boolean;
    errorMessage?: string;
    invalid?: boolean;
    hideBorder?: boolean;
    hideRadio?: boolean;
    items: any[];
    groupDescription: string;
    name: string;
    orientation?: string;
    spacing?: string;
    onBlur?: (() => void);
  };
  Blocks: {
    'default': [{
      component: any;
      data: any;
      index: number;
    }],
  }
}

export default class RadioInput extends Component<Signature> {
  helperId = guidFor(this);
  <template>
    {{#let (and @invalid @errorMessage) as |shouldShowErrorMessage|}}
      <Container
        @groupDescription={{@groupDescription}}
        @disabled={{@disabled}}
        @spacing={{or @spacing 'default'}}
        @orientation={{or @orientation "horizontal"}}
        class={{cn
          "boxel-radio-input"
          boxel-radio-input--invalid=@invalid
        }}
        ...attributes
      >
        {{#each @items as |item i|}}
          {{yield (hash
            component=(component Item
              name=@name
              disabled=@disabled
              hideRadio=@hideRadio
              hideBorder=@hideBorder
              onBlur=@onBlur
              checked=(if @checkedId (eq @checkedId item.id))
            )
            data=item
            index=i)}}
        {{/each}}
      </Container>
      {{#if shouldShowErrorMessage}}
        <div id={{concat "error-message-" this.helperId}} class="boxel-radio-input__error-message" aria-live="polite" data-test-boxel-radio-input-error-message>{{@errorMessage}}</div>
      {{/if}}
    {{/let}}

  </template>
}
