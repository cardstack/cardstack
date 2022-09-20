import Component from '@glimmer/component';
import '@cardstack/boxel/styles/global.css';
import './index.css';
import cn from '@cardstack/boxel/helpers/cn';
import { tracked } from '@glimmer/tracking';

//@ts-expect-error glint does not think this is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { array, concat, hash } from '@ember/helper';
import or from 'ember-truth-helpers/helpers/or';
import eq from 'ember-truth-helpers/helpers/eq';
import not from 'ember-truth-helpers/helpers/not';
import Container from './container';
import LoadingIndicator from '../loading-indicator';
import { LinkTo } from '@ember/routing';
import { Input } from '@ember/component';
import { on } from '@ember/modifier';
import optional from 'ember-composable-helpers/helpers/optional';
import { action } from '@ember/object';

interface Signature {
  Element: HTMLButtonElement | HTMLAnchorElement;
  Args: {
    as?: string;
    kind?: string;
    disabled?: boolean;
    loading?: boolean;
    route?: any;
    models?: any;
    query?: any;
    size?: string;
    href?: string;
    class?: string;
  };
  Blocks: {
    'default': [],
  }
}


const Button: TemplateOnlyComponent<Signature> = <template>
  {{!--
  anything that's used as a label does not have its semantics in a screenreader.
  that seems ok, since you probably shouldn't make a form work as document hierarchy.
  aria-labelledby seems friendlier to safari than the for element, but unsure about other browsers.
  --}}
  {{#let (eq @value @chosenValue) as |checked|}}
    <label
      class={{cn
        "boxel-toggle-button-group-option"
        boxel-toggle-button-group-option--checked=checked
        boxel-toggle-button-group-option--disabled=@disabled
        boxel-toggle-button-group-option--hidden-border=@hideBorder
        boxel-toggle-button-group-option--has-radio=(not @hideRadio)
      }}
      data-test-boxel-toggle-button-group-option
      data-test-boxel-toggle-button-group-option-checked={{checked}}
      data-test-boxel-toggle-button-group-option-disabled={{@disabled}}
      ...attributes
    >
      <Input
        name={{@name}}
        class={{cn
          "boxel-toggle-button-group-option__input"
          boxel-toggle-button-group-option__input--hidden-radio=@hideRadio
          boxel-toggle-button-group-option__input--checked=checked
        }}
        @type="radio"
        {{!-- @checked={{@checked}} --}}
        @value={{@value}}
        disabled={{@disabled}}
        {{on "change" (optional @onChange)}}
      />
      <div>
        {{yield}}
      </div>
    </label>
  {{/let}}
</template>;

export default class ToggleButtonGroupComponent extends Component<Signature> {
  @tracked value = undefined;

  @action doIt(e: Event) {
    console.log(e.target.value);
    this.value = e.target.value;
  }
  <template>
    <fieldset class="boxel-toggle-button-group__fieldset" disabled={{@disabled}} ...attributes>
      <legend class="boxel-toggle-button-group__fieldset-legend">
        {{@groupDescription}}
      </legend>
      {{!-- this div is necessary because Chrome has a special case for fieldsets and it breaks grid auto placement --}}
      <div class={{cn
          "boxel-toggle-button-group__fieldset-container"
          boxel-toggle-button-group__fieldset-container--compact=(eq @spacing "compact")
          boxel-toggle-button-group__fieldset-container--horizontal=(eq @orientation "horizontal")
          boxel-toggle-button-group__fieldset-container--vertical=(eq @orientation "vertical")
        }}
      >
        {{yield
            (hash
              Button=(component
                Button
                kind="primary"
                disabled=@disabled
                name=@name
                onChange=this.doIt
                chosenValue=this.value
              )
            )
      }}
      </div>
    </fieldset>
  </template>
}


declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::ToggleButtonGroup': typeof ToggleButtonGroupComponent;
  }
}
