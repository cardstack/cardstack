import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import BoxelActionContainer from './index';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import { fn } from '@ember/helper';


export default class extends Component {
  @tracked isComplete = false;
  @tracked header = 'Card Header';
  @tracked incompleteActionLabel = 'Save';
  @tracked completeActionLabel = 'Edit value';

  @tracked sectionTitle: string | undefined = "This is a title";
  @tracked sectionIcon: string | undefined = "gear";
  @tracked sectionImgUrl: string | undefined = "https://app.cardstack.com/images/icons/cardstack-a5b868cb17cd30870c84.svg";
  @tracked sectionDataTestId: string | undefined = "example";

  log() {
    console.log(...arguments);
  }

  <template>
    <FreestyleUsage @name="ActionContainer">
      <:description>
        Preconfigured CardContainer for an action card, yields Section and ActionChin.
      </:description>
      <:example>
        <BoxelActionContainer
          @header={{this.header}}
          as |Section ActionChin|>
          {{!-- Sample block yield --}}
            <Section @title="A Section Title">
              <div>And some more content...</div>
            </Section>
            <ActionChin @state='default'>
              <:default as |a|>
                <a.ActionButton>
                  Default
                </a.ActionButton>
                <a.CancelButton>
                  Cancel
                </a.CancelButton>
              </:default>
            </ActionChin>
          {{!-- End of sample block yield --}}
        </BoxelActionContainer>
      </:example>
      <:api as |Args|>
        <Args.String
          @name="header"
          @description="action card header/label"
          @onInput={{fn (mut this.header)}}
          @value={{this.header}}
        />
        <Args.Yield
          @optional={{true}}
          @description="Unstyled area for custom card content and fields; yields a Section component that takes an optional title and applies an appropriate inset"
        />
        <Args.Yield
          @optional={{true}}
          @description="Boxel::ActionChin"
        />
      </:api>
    </FreestyleUsage>
    <FreestyleUsage @name="Details on the Section component yielded by ActionContainer">
      <:description>
        The ActionContainer components yields a contextual component called Section, which lets you inset content within an ActionContainer in a consistent manner,
        and render an optional title. This example documents how this component works.
      </:description>
      <:example>
        <BoxelActionContainer
          @header="Card Header"
          as |Section|>
          {{!-- Sample block yield --}}
            <Section
              @title={{this.sectionTitle}}
              @icon={{this.sectionIcon}}
              @imgUrl={{this.sectionImgUrl}}
              @dataTestId={{this.sectionDataTestId}}
            >
              <div>Content goes here...</div>
            </Section>
          {{!-- End of sample block yield --}}
        </BoxelActionContainer>
      </:example>
       <:api as |Args|>
        <Args.String
          @name="title"
          @description="section title"
          @onInput={{fn (mut this.sectionTitle)}}
          @value={{this.sectionTitle}}
        />
        <Args.String
          @name="icon"
          @description="section icon (optional, displayed with title)"
          @onInput={{fn (mut this.sectionIcon)}}
          @value={{this.sectionIcon}}
        />
        <Args.String
          @name="imgUrl"
          @description="section image (optional, displayed to the right of the title, suitable for a logo)"
          @onInput={{fn (mut this.sectionImgUrl)}}
          @value={{this.sectionImgUrl}}
        />
        <Args.String
          @name="dataTestId"
          @description="section test identifier, set as value of data-test-boxel-action-container-section attribute (not visible to users)"
          @onInput={{fn (mut this.sectionDataTestId)}}
          @value={{this.sectionDataTestId}}
        />
      </:api>
   </FreestyleUsage>
  </template>
}
