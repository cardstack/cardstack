import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import './usage.css';
import { type ActionChinState } from './state';
import { type EmptyObject } from '@ember/component/helper';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelActionChin from './index';
import BoxelButton from '../button';
import BoxelLoadingIndicator from '../loading-indicator';
import { on } from '@ember/modifier';
import cssVar from '@cardstack/boxel/helpers/css-var';
//@ts-expect-error glint does not think array is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { array, fn } from '@ember/helper';
import { cssVariable, CSSVariableInfo } from 'ember-freestyle/decorators/css-variable';

let inProgressTimeout: number;

interface Signature {
  Element: HTMLDivElement;
  Args: EmptyObject;
  Blocks: EmptyObject;
}

export default class ActionChinUsage extends Component<Signature> {
  @tracked stepNumber = 0;
  @tracked state: ActionChinState = 'default';
  @tracked disabled = false;
  @tracked isComplete = false;
  @tracked unlockState: ActionChinState = 'default';
  @tracked depositState: ActionChinState = 'disabled';

  cssClassName = 'boxel-action-chin';
  @cssVariable declare boxelActionChinPaddingHorizontal: CSSVariableInfo;
  @cssVariable declare boxelActionChinPaddingVertical: CSSVariableInfo;
  @cssVariable declare boxelActionChinBackgroundColor: CSSVariableInfo;
  @cssVariable declare boxelActionChinEmphasisTextColor: CSSVariableInfo;
  @cssVariable declare boxelActionChinTextColor: CSSVariableInfo;

  get depositIsDisabled(): boolean {
    return (
      this.unlockState !== 'memorialized' || this.depositState === 'disabled'
    );
  }

  @action changeState(str: ActionChinState): void {
    this.unlockState = str;
    if (str === 'in-progress') {
      inProgressTimeout = window.setTimeout(() => {
        this.changeState('memorialized');
        this.depositState = 'default';
      }, 1500);
    }

    if (str === 'memorialized' || str === 'default') {
      window.clearTimeout(inProgressTimeout);
    }
  }

  @action toggleComplete(): void {
    this.isComplete = !this.isComplete;
  }

  <template>
    <FreestyleUsage @name="ActionChin">
      <:description>
        Bottom action area for an action card, a.k.a the "Chin".<br><br>
        Use the API controls below to change <code>state</code> and <code>stepNumber</code>.

        <h2>ActionChin Explanation</h2>
        <div class="usage-cta-block-explanation">
          CTAs are meant to guide users to take a single action.
          There are a few different states for this component:
          <table class="usage-cta-block-explanation-table">
            <tbody>
              <tr><td>State</td><td>Explanation</td></tr>
              <tr><td>default</td> <td>When the user has not met the requirements for the cta to be considered done</td></tr>
              <tr><td>in-progress</td> <td>When the action is in progress</td></tr>
              <tr><td>memorialized</td> <td>When the action is done</td></tr>
            </tbody>
          </table>
          CtaBlock provides components to use within it - these components have appropriate classes to place them in the correct spots in the layout, and have correct states.
          The ActionButton and CancelButton components use the Button component and should accept all arguments it does.
          The InfoArea and ActionStatusArea components are essentially divs, which you can put your custom contents in.
          <table class="usage-cta-block-explanation-table">
            <tbody>
              <tr>
                <td>
                  Component
                </td>
                <td>
                  What it does
                </td>
                <td>
                  Provided in states
                </td>
              </tr>
              <tr>
                <td>
                  ActionButton
                </td>
                <td>
                  The button that's used to perform the main action for this CTA. It undergoes a few changes in styling in between states.
                </td>
                <td>
                  <ul>
                    <li>default</li>
                    <li>memorialized</li>
                    <li>in-progress</li>
                  </ul>
                </td>
              </tr>
              <tr>
                <td>
                  ActionStatusArea
                </td>
                <td>
                  Memorialized state status update area for the main action, that is built to accept a small descriptive statement - eg. "Unlocked".
                  It should be used when an action is completed, replacing the ActionButton.
                  <br>
                  <br>
                  It accepts a <code>@icon</code> argument. By default, it shows a checkmark as the icon.
                  <br>
                  <br>
                  <strong>Don't use this and ActionButton together, they occupy the same grid area!</strong>
                </td>
                <td>
                  <ul>
                    <li>default</li>
                    <li>memorialized</li>
                    <li>in-progress</li>
                  </ul>
                </td>
              </tr>
              <tr>
                <td>
                  CancelButton
                </td>
                <td>
                  Button to cancel the main action.
                </td>
                <td>
                  <ul>
                    <li>default</li>
                    <li>in-progress</li>
                  </ul>
                </td>
              </tr>
              <tr>
                <td>
                  InfoArea
                </td>
                {{!-- template-lint-disable no-whitespace-for-layout --}}
                <td>
                  An area used for any relevant information to the action (eg for status updates),
                  on the right end of the chin.
                </td>
                <td>
                  <ul>
                    <li>default</li>
                    <li>memorialized</li>
                    <li>in-progress</li>
                  </ul>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
    </:description>
    <:example>
      <BoxelActionChin
        @stepNumber={{this.stepNumber}}
        @state={{this.state}}
        @disabled={{this.disabled}}
        style={{cssVar
          boxel-action-chin-padding-horizontal=this.boxelActionChinPaddingHorizontal.value
          boxel-action-chin-padding-vertical=this.boxelActionChinPaddingVertical.value
          boxel-action-chin-background-color=this.boxelActionChinBackgroundColor.value
          boxel-action-chin-emphasis-text-color=this.boxelActionChinEmphasisTextColor.value
          boxel-action-chin-text-color=this.boxelActionChinTextColor.value
        }}
      >
        <:default as |a|>
          <a.ActionButton>
            Default CTA
          </a.ActionButton>
          <a.CancelButton>
            Cancel
          </a.CancelButton>
          <a.InfoArea>
            Custom info area
          </a.InfoArea>
        </:default>
        <:inProgress as |i|>
          <i.ActionButton>
            In-progress
          </i.ActionButton>
          <i.CancelButton>
            Cancel
          </i.CancelButton>
          <i.InfoArea>
            Custom info area
          </i.InfoArea>
        </:inProgress>
        <:memorialized as |m|>
          <m.ActionStatusArea>
            Memorialized
          </m.ActionStatusArea>
          <m.InfoArea>
            Custom info area
          </m.InfoArea>
        </:memorialized>
      </BoxelActionChin>
    </:example>
    <:api as |Args|>
      <Args.String
        @name="state"
        @description="Whether the action is at at rest, in progress, or memorialized."
        @options={{array "default" "in-progress" "memorialized"}}
        @defaultValue="default"
        @value={{this.state}}
        @onInput={{fn (mut this.state)}}
      />
      <Args.Bool
        @name="disabled"
        @description="Whether the action chin is disabled. If state is default, will show the disabled named block if available."
        @defaultValue={{false}}
        @value={{this.disabled}}
        @onInput={{fn (mut this.disabled)}}
      />
      <Args.Number
        @name="stepNumber"
        @description="If passed, will add the step number to the left of the block. Having a step number affects the styling of the chin."
        @optional={{true}}
        @value={{this.stepNumber}}
        @onInput={{fn (mut this.stepNumber)}}
      />
      <Args.Yield
        @name="inProgress"
        @description="The block shown when @state is 'in-progress'. Yields { ActionButton, CancelButton, ActionStatusArea, InfoArea }"
      />
      <Args.Yield
        @name="memorialized"
        @description="The block shown when @state is 'memorialized'. Yields { ActionButton, ActionStatusArea, InfoArea }"
      />
      <Args.Yield
        @name="default"
        @description="The default block shown when @state is none of the states above. Yields { ActionButton, ActionStatusArea, InfoArea }"
      />
    </:api>
    <:cssVars as |Css|>
      <Css.Basic
        @name="boxel-action-chin-padding-horizontal"
        @type="dimension"
        @description="Horizontal padding in the action chin"
        @defaultValue={{this.boxelActionChinPaddingHorizontal.defaults}}
        @value={{this.boxelActionChinPaddingHorizontal.value}}
        @onInput={{this.boxelActionChinPaddingHorizontal.update}}
      />
     <Css.Basic
        @name="boxel-action-chin-padding-vertical"
        @type="dimension"
        @description="Vertical padding in the action chin"
        @defaultValue={{this.boxelActionChinPaddingVertical.defaults}}
        @value={{this.boxelActionChinPaddingVertical.value}}
        @onInput={{this.boxelActionChinPaddingVertical.update}}
      />
      <Css.Basic
        @name="boxel-action-chin-background-color"
        @type="color"
        @description="Background color of the action chin"
        @defaultValue={{this.boxelActionChinBackgroundColor.defaults}}
        @value={{this.boxelActionChinBackgroundColor.value}}
        @onInput={{this.boxelActionChinBackgroundColor.update}}
      />
      <Css.Basic
        @name="boxel-action-chin-emphasis-text-color"
        @type="color"
        @description="Text color for the emphasized area of the action chin"
        @defaultValue={{this.boxelActionChinEmphasisTextColor.defaults}}
        @value={{this.boxelActionChinEmphasisTextColor.value}}
        @onInput={{this.boxelActionChinEmphasisTextColor.update}}
      />
      <Css.Basic
        @name="boxel-action-chin-text-color"
        @type="color"
        @description="Text color for the action chin"
        @defaultValue={{this.boxelActionChinTextColor.defaults}}
        @value={{this.boxelActionChinTextColor.value}}
        @onInput={{this.boxelActionChinTextColor.update}}
      />
    </:cssVars>
  </FreestyleUsage>

  <FreestyleUsage @name="Usage with default and memorialized blocks only">
    <:description>
      Click the button to toggle between <code>memorialized</code> and <code>default</code> states.
    </:description>
    <:example>
      <BoxelActionChin @state={{if this.isComplete "memorialized" "default"}}>
        <:default as |d|>
          <d.ActionButton {{on "click" this.toggleComplete}}>
            Save
          </d.ActionButton>
        </:default>
        <:memorialized as |m|>
          <m.ActionButton {{on "click" this.toggleComplete}}>
            Edit
          </m.ActionButton>
        </:memorialized>
      </BoxelActionChin>
    </:example>
  </FreestyleUsage>

  <FreestyleUsage @name="Usage with customized ActionStatusArea and InfoArea">
    <:description>
      <code>ActionStatusArea</code> displays custom content in the action chin.
      It accepts an <code>@icon</code> argument.
      In the <code>:memorialized</code> block, the icon is a checkmark by default.
      <br><br>
      <code>InfoArea</code> replaces the small text area. It can be used with any named block.
    </:description>
    <:example>
      <BoxelActionChin @state="in-progress" as |chin|>
        <chin.ActionStatusArea @icon="metamask" style={{cssVar status-icon-size="2.5rem"}}>
          <BoxelLoadingIndicator class="usage-action-chin__loading-indicator" @color="var(--boxel-light)"/>
          Waiting for you to connect Card Pay with your mainnet wallet…
        </chin.ActionStatusArea>
        <chin.InfoArea>
          Only visible to you
        </chin.InfoArea>
      </BoxelActionChin>
    </:example>
  </FreestyleUsage>

  <FreestyleUsage @name="Multiple chins (stacked chins) with stepNumber">
    <:example>
      <BoxelActionChin
        @stepNumber={{1}}
        @state={{this.unlockState}}
      >
        <:default as |a|>
          <a.ActionButton {{on "click" (fn this.changeState "in-progress")}}>
            Unlock
          </a.ActionButton>
        </:default>
        <:inProgress as |i|>
          <i.ActionButton>
            Unlocking
          </i.ActionButton>
          <i.CancelButton {{on "click" (fn this.changeState "default")}}>
            Cancel
          </i.CancelButton>
        </:inProgress>
        <:memorialized as |m|>
          <m.ActionStatusArea>
            Unlocked
          </m.ActionStatusArea>
          <m.InfoArea>
            <BoxelButton @kind="secondary-light">
              View on Etherscan
            </BoxelButton>
          </m.InfoArea>
        </:memorialized>
      </BoxelActionChin>
      <BoxelActionChin
        @stepNumber={{2}}
        @state={{this.depositState}}
        @disabled={{this.depositIsDisabled}}
      >
        <:default as |a|>
          <a.ActionButton
            @disabled={{this.depositIsDisabled}}
            {{on "click" (fn (mut this.depositState) "memorialized")}}
          >
            Deposit
          </a.ActionButton>
        </:default>
        <:memorialized as |m|>
          <m.ActionStatusArea>
            Deposited
          </m.ActionStatusArea>
          <m.InfoArea>
            <BoxelButton @kind="secondary-light">
              View on Etherscan
            </BoxelButton>
          </m.InfoArea>
        </:memorialized>
      </BoxelActionChin>
    </:example>
  </FreestyleUsage>
</template>
}
