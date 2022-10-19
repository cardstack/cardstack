import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelModal from './index';
import BoxelButton from '../button';
import BoxelCardContainer from '../card-container';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
//@ts-expect-error glint does not think this is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { array, fn } from '@ember/helper';
import cssVar from '@cardstack/boxel/helpers/css-var';
import { on } from '@ember/modifier';
import './usage.css';

type ModalSize = 'small' | 'medium' | 'large' | undefined;

export default class ModalUsage extends Component {
  @tracked isOpen = false;
  @tracked size: ModalSize = undefined;
  @tracked offsetRight = '0px';
  @tracked offsetLeft = '0px';
  @tracked offsetTop = '0px';
  @tracked layer = 'default';
  @tracked isDefaultOpen = false;
  @tracked isUrgentOpen = false;
  @tracked isOverlayDismissalDisabled = false;

  get sizeAsString(): ModalSize | '<undefined>' {
    return this.size ?? '<undefined>';
  }
  @action updateSize(val: ModalSize): void {
    this.size = val;
  }

  @action
  onClose(): void {
    this.isOpen = false;
  }

  @action openDefault(): void {
    this.isDefaultOpen = true;
  }

  @action closeDefault(): void {
    this.isDefaultOpen = false;
  }

  @action openUrgent(): void {
    this.isUrgentOpen = true;
  }

  @action closeUrgent(): void {
    this.isUrgentOpen = false;
  }

  <template>
    <FreestyleUsage
      @name="Modal"
      @description="A 'renderless' modal that places provided content on top of a dark, translucent overlay that obscures the page underneath."
    >
      <:example>
        <BoxelButton @kind="primary" {{on "click" (fn (mut this.isOpen) true)}}>Open</BoxelButton>
        <BoxelModal
          @size={{this.size}}
          @onClose={{this.onClose}}
          @isOpen={{this.isOpen}}
          aria-labelledby="boxel-modal-usage-example-id"
          @isOverlayDismissalDisabled={{this.isOverlayDismissalDisabled}}
          style={{cssVar
            boxel-modal-offset-top=this.offsetTop
            boxel-modal-offset-left=this.offsetLeft
            boxel-modal-offset-right=this.offsetRight
          }}>
          <BoxelCardContainer class="boxel-modal-usage-container">
            <h2 id="boxel-modal-usage-example-id">Boxel Modal</h2>
            <p>
              Hi! This is some content.
            </p>
            <BoxelButton {{on "click" this.onClose}}>OK</BoxelButton>
          </BoxelCardContainer>
        </BoxelModal>
      </:example>
      <:api as |Args|>
        <Args.String @name="size" @description="Can be 'small', 'medium', 'large', or unspecified. Sets a predetermined max-width to inner modal." @value={{this.sizeAsString}} @options={{array "small" "medium" "large" "<undefined>"}} @onInput={{this.updateSize}} @defaultValue="<undefined>" />
        <Args.String @name="--boxel-modal-offset-right" @description="Right offset for the inner modal" @value={{this.offsetRight}} @onInput={{fn (mut this.offsetRight)}} @optional={{true}} @defaultValue="0px" />
        <Args.String @name="--boxel-modal-offset-left" @description="Left offset for the inner modal" @value={{this.offsetLeft}} @onInput={{fn (mut this.offsetLeft)}} @optional={{true}} @defaultValue="0px" />
        <Args.String @name="--boxel-modal-offset-top" @description="Top offset for the inner modal" @value={{this.offsetTop}} @onInput={{fn (mut this.offsetTop)}} @optional={{true}} @defaultValue="0px" />
        <Args.Bool
          @name="isOpen"
          @description="Condition for opening the modal"
          @value={{this.isOpen}}
          @defaultValue={{false}}
          @onInput={{fn (mut this.isOpen)}}
          @required={{true}}
        />
        <Args.String
          @name="layer"
          @description="Which of Boxel's z-index layers should be used for this modal"
          @value={{this.layer}}
          @defaultValue={{"default"}}
          @options={{array "default" "urgent"}}
          @onInput={{fn (mut this.layer)}}
          @optional={{true}}
        />
        <Args.Action
          @name="onClose"
          @description="Callback when the modal's background overlay is clicked or the escape key is pressed"
          @value={{this.onClose}}
          @required={{true}}
        />
        <Args.Bool
          @name="isOverlayDismissalDisabled"
          @description="Disables overlay interaction to avoid modal dismissal"
          @value={{this.isOverlayDismissalDisabled}}
          @defaultValue={{false}}
          @onInput={{fn (mut this.isOverlayDismissalDisabled)}}
        />
        <Args.Yield @description="The content of the modal. This visually sits directly on the overlay - there is no 'container' rendered by default." />
      </:api>
    </FreestyleUsage>

    <FreestyleUsage
      @name="Modals have two different layers, urgent and default"
    >
    <:example>
    <BoxelButton @kind="primary" {{on "click" this.openDefault}}>Open</BoxelButton>
    <BoxelModal
      @onClose={{this.closeDefault}}
      @isOpen={{this.isDefaultOpen}}
    >
      <BoxelCardContainer class="boxel-modal-usage-container">
        <h2>Boxel Modal Default Layer</h2>
        <p>
          This modal is on the default layer. It should be below the modal on the urgent layer.
        </p>

        <BoxelButton {{on "click" this.openUrgent}}>Open an urgent modal</BoxelButton>
        <BoxelButton {{on "click" this.closeDefault}}>Close this</BoxelButton>
      </BoxelCardContainer>
    </BoxelModal>
    <BoxelModal
      @onClose={{this.closeUrgent}}
      @isOpen={{this.isUrgentOpen}}
    >
      <BoxelCardContainer class="boxel-modal-usage-container">
        <h2>Boxel Modal Urgent Layer</h2>
        <p>
          This modal is on the urgent layer. It should be above the default layer modal.
        </p>

        <BoxelButton {{on "click" this.closeUrgent}}>Close this</BoxelButton>
      </BoxelCardContainer>
    </BoxelModal>
    </:example>
    </FreestyleUsage>    
  </template>
}
