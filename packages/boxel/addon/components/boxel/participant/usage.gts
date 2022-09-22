import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelParticipant from './index';
import { fn } from '@ember/helper';

import HaileyImage from '@cardstack/boxel/usage-support/images/users/Haley-OConnell.jpg';

export default class ParticipantUsageComponent extends Component {
  @tracked title = 'Haley O’Connell';
  @tracked description = 'Writer';
  @tracked image = HaileyImage;
  @tracked iconSize: string | undefined;
  @tracked iconOnly = false;
  @tracked hasLogo = false;
  @tracked vertical = false;

  <template>
    <FreestyleUsage @name="Participant">
      <:example>
        <BoxelParticipant
          @title={{this.title}}
          @description={{this.description}}
          @image={{this.image}}
          @iconSize={{this.iconSize}}
          @iconOnly={{this.iconOnly}}
          @hasLogo={{this.hasLogo}}
          @vertical={{this.vertical}}
        />
      </:example>
      <:api as |Args|>
        <Args.String
          @name="title"
          @description="Display name"
          @value={{this.title}}
          @onInput={{fn (mut this.title)}}
        />
        <Args.String
          @name="description"
          @description="Text that appears under the name"
          @value={{this.description}}
          @onInput={{fn (mut this.description)}}
        />
        <Args.String
          @name="image"
          @description="Defaults to generic profile icon"
          @value={{this.image}}
          @onInput={{fn (mut this.image)}}
        />
        <Args.String
          @name="iconSize"
          @description="Height and width of the image in any unit"
          @value={{this.iconSize}}
          @defaultValue="2rem"
          @onInput={{fn (mut this.iconSize)}}
        />
        <Args.Bool
          @name="iconOnly"
          @value={{this.iconOnly}}
          @description="If true, displays the icon only"
          @defaultValue={{false}}
          @onInput={{fn (mut this.iconOnly)}}
        />
        <Args.Bool
          @name="hasLogo"
          @value={{this.hasLogo}}
          @description="If true, alternative styling is applied"
          @defaultValue={{false}}
          @onInput={{fn (mut this.hasLogo)}}
        />
        <Args.Bool
          @name="vertical"
          @description="Whether the image should be above the text"
          @defaultValue="false"
          @onInput={{fn (mut this.vertical)}}
          @value={{this.vertical}}
        />
      </:api>
    </FreestyleUsage>    
  </template>
}
