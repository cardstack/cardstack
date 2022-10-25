import type { TemplateOnlyComponent } from '@ember/component/template-only';
import Container from './container';
import Item from './item';
import eq from 'ember-truth-helpers/helpers/eq';
import or from 'ember-truth-helpers/helpers/or';
//@ts-expect-error glint does not think this is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { hash } from '@ember/helper';

import '@cardstack/boxel/styles/global.css';
import './index.css';

export interface Signature {
  Element: HTMLFieldSetElement;
  Args: {
    checkedId?: string;
    disabled?: boolean;
    hideBorder?: boolean;
    hideRadio?: boolean;
    items: any[];
    groupDescription: string;
    name: string;
    orientation?: string;
    spacing?: string;
  };
  Blocks: {
    'default': [{
      component: any;
      data: any;
      index: number;
    }],
  }
}

const RadioInput: TemplateOnlyComponent<Signature> = <template>
  <Container
    @groupDescription={{@groupDescription}}
    @disabled={{@disabled}}
    @spacing={{or @spacing 'default'}}
    @orientation={{or @orientation "horizontal"}}
    class="boxel-radio-input"
    ...attributes
  >
    {{#each @items as |item i|}}
      {{yield (hash
        component=(component Item
          name=@name
          disabled=@disabled
          hideRadio=@hideRadio
          hideBorder=@hideBorder
          checked=(if @checkedId (eq @checkedId item.id))
        )
        data=item
        index=i)}}
    {{/each}}
  </Container>
</template>

export default RadioInput;
