import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelInputGroup from './index';
import BoxelField from '../field';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import copyToClipboard from '@cardstack/boxel/helpers/copy-to-clipboard';
import { later } from '@ember/runloop';
import { A } from '@ember/array';
import cssVar from '@cardstack/boxel/helpers/css-var';
import { cssVariable, CSSVariableInfo } from 'ember-freestyle/decorators/css-variable';

interface Token {
  name: string;
  icon: string;
}

export default class BoxelInputGroupUsage extends Component {
  @tracked id = 'boxel-input-group-usage';
  @tracked value = '';
  @tracked placeholder: string | undefined;
  @tracked autocomplete: string | undefined;
  @tracked inputmode: string | undefined;
  @tracked helperText = 'Please enter an amount';
  @tracked errorMessage = '';
  @tracked disabled = false;
  @tracked invalid = false;
  @tracked isShowingCopiedConfirmation = false;

  cssClassName = 'boxel-input-group';
  @cssVariable declare boxelInputGroupPaddingX: CSSVariableInfo;
  @cssVariable declare boxelInputGroupPaddingY: CSSVariableInfo;
  @cssVariable declare boxelInputGroupBorderColor: CSSVariableInfo;
  @cssVariable declare boxelInputGroupBorderRadius: CSSVariableInfo;
  @cssVariable declare boxelInputGroupInteriorBorderWidth: CSSVariableInfo;

  tokens = [
    { name: 'CARD', icon: 'card' },
    { name: 'HI', icon: 'emoji' },
    { name: 'WORLD', icon: 'world' },
  ];
  @tracked token = this.tokens[0];

  @action set(val: string): void {
    this.value = val;
  }

  @action log(s: string, _ev: Event): void {
    console.log(s);
  }

  @action onChooseToken(token: Token) {
    this.token = token;
    console.log(token);
  }

  @action flashCopiedConfirmation() {
    this.isShowingCopiedConfirmation = true;
    later(() => {
      this.isShowingCopiedConfirmation = false;
    } , 1000)
  }

  @tracked selectExampleItems = A([...new Array(10)].map((_, idx) => `Item - ${idx}`));

  @tracked selectExampleSelectedItem: string | null = null;
  @tracked selectExamplePlaceholder: string = 'Select Item';

  @action selectExampleOnSelectItem(item: string| null): void {
    this.selectExampleSelectedItem = item;
  }

  <template>
    <FreestyleUsage @name="InputGroup">
      <:description>
        Extend inputs by adding text, buttons, etc on either side of textual inputs.
      </:description>
      <:example>
        <label for={{this.id}} class="boxel-sr-only">Label</label>
        <BoxelInputGroup
          @id={{this.id}}
          @disabled={{this.disabled}}
          @value={{this.value}}
          @placeholder={{this.placeholder}}
          @autocomplete={{this.autocomplete}}
          @inputmode={{this.inputmode}}
          @onInput={{this.set}}
          @onBlur={{fn this.log 'InputGroup onBlur'}}
          @invalid={{this.invalid}}
          @errorMessage={{this.errorMessage}}
          @helperText={{this.helperText}}
          style={{cssVar
            boxel-input-group-padding-x=this.boxelInputGroupPaddingX.value
            boxel-input-group-padding-y=this.boxelInputGroupPaddingY.value
            boxel-input-group-border-color=this.boxelInputGroupBorderColor.value
            boxel-input-group-border-radius=this.boxelInputGroupBorderRadius.value
            boxel-input-group-interior-border-width=this.boxelInputGroupInteriorBorderWidth.value
          }}
        >
          <:before as |Accessories|>
            <Accessories.Text>Something before</Accessories.Text>
          </:before>
        </BoxelInputGroup>
      </:example>
      <:api as |Args|>
        <Args.String
          @name="id"
          @description="The id of the input"
          @onInput={{fn (mut this.id)}}
          @value={{this.id}}
        />
        <Args.Bool
          @name="disabled"
          @description="Whether the input is disabled"
          @defaultValue={{false}}
          @onInput={{fn (mut this.disabled)}}
          @value={{this.disabled}}
        />
        <Args.Bool
          @name="invalid"
          @description="Whether the input is invalid"
          @defaultValue={{false}}
          @onInput={{fn (mut this.invalid)}}
          @value={{this.invalid}}
        />
        <Args.String
          @name="helperText"
          @description="Helper message to display below the input"
          @value={{this.helperText}}
          @onInput={{fn (mut this.helperText)}}
        />
        <Args.String
          @name="errorMessage"
          @description="Error message to display when the input is invalid"
          @value={{this.errorMessage}}
          @onInput={{fn (mut this.errorMessage)}}
        />
        <Args.String
          @name="placeholder"
          @description="The placeholder text for the input (ignored when a default block is supplied)"
          @value={{this.placeholder}}
          @onInput={{fn (mut this.placeholder)}}
        />
        <Args.String
          @name="autocomplete"
          @description="The autocomplete attribute value for the input (ignored when a default block is supplied)"
          @value={{this.autocomplete}}
          @onInput={{fn (mut this.autocomplete)}}
        />
        <Args.String
          @name="inputmode"
          @description="The inputmode attribute value for the input (ignored when a default block is supplied)"
          @value={{this.inputmode}}
          @onInput={{fn (mut this.inputmode)}}
        />
        <Args.String
          @name="value"
          @description="The value of the input"
          @value={{this.value}}
          @onInput={{fn (mut this.value)}}
        />
        <Args.Action
          @name="onInput"
          @description="Action to call when the input value changes"
        />
        <Args.Action
          @name="onBlur"
          @description="Action to call when the input value loses focus"
        />
      </:api>
      <:cssVars as |Css|>
        <Css.Basic
          @name="boxel-input-group-padding-x"
          @type="dimension"
          @description="Horizontal padding"
          @defaultValue={{this.boxelInputGroupPaddingX.defaults}}
          @value={{this.boxelInputGroupPaddingX.value}}
          @onInput={{this.boxelInputGroupPaddingX.update}}
        />
        <Css.Basic
          @name="boxel-input-group-padding-y"
          @type="dimension"
          @description="Vertical padding"
          @defaultValue={{this.boxelInputGroupPaddingY.defaults}}
          @value={{this.boxelInputGroupPaddingY.value}}
          @onInput={{this.boxelInputGroupPaddingY.update}}
        />
        <Css.Basic
          @name="boxel-input-group-border-color"
          @type="color"
          @description="Border color"
          @defaultValue={{this.boxelInputGroupBorderColor.defaults}}
          @value={{this.boxelInputGroupBorderColor.value}}
          @onInput={{this.boxelInputGroupBorderColor.update}}
        />
        <Css.Basic
          @name="boxel-input-group-border-radius"
          @type="dimension"
          @description="Border radius"
          @defaultValue={{this.boxelInputGroupBorderRadius.defaults}}
          @value={{this.boxelInputGroupBorderRadius.value}}
          @onInput={{this.boxelInputGroupBorderRadius.update}}
        />
        <Css.Basic
          @name="boxel-input-group-interior-border-width"
          @type="dimension"
          @description="Interior border width (CSS Variable). Set to zero for no interior borders"
          @defaultValue={{this.boxelInputGroupInteriorBorderWidth.defaults}}
          @value={{this.boxelInputGroupInteriorBorderWidth.value}}
          @onInput={{this.boxelInputGroupInteriorBorderWidth.update}}
        />
      </:cssVars>
    </FreestyleUsage>
    <style>
      .boxel-input-usage-examples .boxel-input-group {
        margin-bottom: var(--boxel-sp-xl);
      }
      .boxel-input-group-usage-select-example__dropdown {
        height: 20px;
        width: 100px;
        min-width: 100px;
        display: flex;
        align-items: center;
        user-select: none;
      }
      .boxel-input-group-usage-select-example__dropdown__icon {
        width: var(--boxel-icon-sm);
        height: var(--boxel-icon-sm);
      }
      .boxel-input-group-usage-select-example__dropdown .ember-power-select-status-icon {
        background: url("/@cardstack/boxel/images/icons/caret-down.svg") no-repeat;
        width: 11px;
        height: 9px;
        display: inline-block;
      }
    </style>
    <FreestyleUsage @name="InputGroupExamples" class="boxel-input-usage-examples">
      <:example>
        <BoxelInputGroup
          @placeholder="Username"
        >
          <:before as |Accessories|>
            <Accessories.Text>@</Accessories.Text>
          </:before>
        </BoxelInputGroup>

        <BoxelInputGroup
          @placeholder="Recipient's username"
        >
          <:after as |Accessories|>
            <Accessories.Text>@example.com</Accessories.Text>
          </:after>
        </BoxelInputGroup>

        <BoxelField
          @tag="label"
          @label="Your vanity URL"
          @vertical={{true}}
        >
          <BoxelInputGroup>
            <:before as |Accessories|>
              <Accessories.Text>https://example.com/users/</Accessories.Text>
            </:before>
          </BoxelInputGroup>
        </BoxelField>

        <BoxelInputGroup
          @placeholder="Amount"
        >
          <:before as |Accessories|>
            <Accessories.Text>$</Accessories.Text>
          </:before>
          <:after as |Accessories|>
            <Accessories.Text>.00</Accessories.Text>
          </:after>
        </BoxelInputGroup>

        <BoxelInputGroup>
          <:default as |Controls Accessories|>
            <Controls.Input @placeholder="Username" />
            <Accessories.Text>@</Accessories.Text>
            <Controls.Input @placeholder="Server" />
          </:default>
        </BoxelInputGroup>

        <label>Example overriding default block to use a textarea instead of a text input<br />
          <BoxelInputGroup>
            <:default as |Controls Accessories inputGroup|>
              <Accessories.Text>With textarea</Accessories.Text>
              <Controls.Textarea id={{inputGroup.elementId}} />
            </:default>
          </BoxelInputGroup>
        </label>

        <label>Example showing multiple accessories before the input<br />
          <BoxelInputGroup>
            <:before as |Accessories|>
              <Accessories.Text>$</Accessories.Text>
              <Accessories.Text>0.00</Accessories.Text>
            </:before>
          </BoxelInputGroup>
        </label>

        <label>Example showing multiple accessories after the input<br />
          <BoxelInputGroup>
            <:after as |Accessories|>
              <Accessories.Text>$</Accessories.Text>
              <Accessories.Text>0.00</Accessories.Text>
            </:after>
          </BoxelInputGroup>
        </label>

        <label>Example showing a button accessories after the input<br />
          <BoxelInputGroup>
            <:before as |Accessories|>
              <Accessories.Button>Button</Accessories.Button>
            </:before>
          </BoxelInputGroup>
        </label>

        <BoxelInputGroup @placeholder="Recipient's username">
          <:after as |Accessories|>
            <Accessories.Button>Button</Accessories.Button>
          </:after>
        </BoxelInputGroup>

        <BoxelInputGroup @placeholder="The button has a 'kind' of 'primary'">
          <:after as |Accessories|>
            <Accessories.Button @kind="primary">Button</Accessories.Button>
          </:after>
        </BoxelInputGroup>

        <BoxelInputGroup @placeholder="Example with two buttons before">
          <:before as |Accessories|>
            <Accessories.Button>Button</Accessories.Button>
            <Accessories.Button>Button</Accessories.Button>
          </:before>
        </BoxelInputGroup>

        <BoxelInputGroup @placeholder="Example with two buttons after">
          <:after as |Accessories|>
            <Accessories.Button>Button</Accessories.Button>
            <Accessories.Button>Button</Accessories.Button>
          </:after>
        </BoxelInputGroup>

        <label>Example showing an icon button with copy to clipboard functionality after the input<br />
          <BoxelInputGroup @value="Copyable text" @readonly={{true}}>
            <:after as |Accessories inputGroup|>
              {{#if this.isShowingCopiedConfirmation}}
                <Accessories.Text>Copied!</Accessories.Text>
              {{/if}}
              <Accessories.IconButton
                @icon="copy"
                aria-label="Copy to Clipboard"
                {{on "click" (copyToClipboard
                  elementId=inputGroup.elementId
                  onCopy=this.flashCopiedConfirmation
                )}}
              />
            </:after>
          </BoxelInputGroup>
        </label>

        <BoxelInputGroup @placeholder="Input with a select menu">
          <:after as |Accessories|>
            <Accessories.Select
              @placeholder={{this.selectExamplePlaceholder}}
              @selected={{this.selectExampleSelectedItem}}
              @onChange={{this.selectExampleOnSelectItem}}
              @options={{this.selectExampleItems}}
              @dropdownClass="boxel-select-usage-dropdown"
              as |item itemCssClass|
            >
              <div class={{itemCssClass}}>{{item}}</div>
            </Accessories.Select>
          </:after>
        </BoxelInputGroup>
      </:example>
    </FreestyleUsage>
  </template>
}
