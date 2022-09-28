import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelParticipantList from './index';
import { tracked } from '@glimmer/tracking';
import { A } from '@ember/array';
import { fn } from '@ember/helper';
import HaleyOConnellThumb from '@cardstack/boxel/usage-support/images/users/Haley-OConnell.jpg';
import JuliaMasonThumb from '@cardstack/boxel/usage-support/images/users/Julia-Mason.jpg';
import LolaSampsonThumb from '@cardstack/boxel/usage-support/images/users/Lola-Sampson.jpg';
import RupertGrishamThumb from '@cardstack/boxel/usage-support/images/users/Rupert-Grisham.jpg';
import HSHIcon from '@cardstack/boxel/usage-support/images/orgs/hsh-icon.png';

const SAMPLE_PARTICIPANTS = [
  {
    type: 'organization',
    title: 'Home Sweet Home',
    imgURL: HSHIcon,
  },
  {
    title: 'Lola Sampson',
    imgURL: LolaSampsonThumb,
  },
  {
    title: 'Haley O’Connell',
    imgURL: HaleyOConnellThumb,
    role: 'Writer',
  },
  {
    title: 'Rupert Grisham',
    imgURL: RupertGrishamThumb,
  },
  {
    title: 'Julia Mason',
    imgURL: JuliaMasonThumb,
  },
];

export default class ParticipantListUsageComponent extends Component {
  @tracked participants = A(SAMPLE_PARTICIPANTS);
  @tracked participantsNoOrg = SAMPLE_PARTICIPANTS.slice(1);
  @tracked iconSize = '2rem';
  @tracked maxCount = 5;
  @tracked fanned = false;
  @tracked iconOnly = false;
  @tracked hasLogo = false;
  @tracked fullWidth = false;

  <template>
    <FreestyleUsage @name="ParticipantList">
      <:example>
        <BoxelParticipantList
          @participants={{this.participants}}
          @maxCount={{this.maxCount}}
          @fanned={{this.fanned}}
          @iconSize={{this.iconSize}}
          @iconOnly={{this.iconOnly}}
          @hasLogo={{this.hasLogo}}
        />
      </:example>
      <:api as |Args|>
        <Args.Number
          @name="maxCount"
          @value={{this.maxCount}}
          @description="(integer) — Max number of items to display."
          @defaultValue={{5}}
          @min={{1}}
          @max={{this.participants.length}}
          @onInput={{fn (mut this.maxCount)}}
        />
        <Args.Bool
          @name="fanned"
          @value={{this.fanned}}
          @description="If true, displays icons in a fanned out style."
          @defaultValue={{false}}
          @onInput={{fn (mut this.fanned)}}
        />
        <Args.Bool
          @name="fullWidth"
          @value={{this.fullWidth}}
          @description="If true, the list's width is 100%."
          @defaultValue={{false}}
          @onInput={{fn (mut this.fullWidth)}}
        />
        <Args.String
          @name="iconSize"
          @description="Height and width of each item's icon in any unit"
          @value={{this.iconSize}}
          @defaultValue="2rem"
          @onInput={{fn (mut this.iconSize)}}
        />
        <Args.Bool
          @name="iconOnly"
          @value={{this.iconOnly}}
          @description="If true, displays the icon only. Set to true if @fanned is true."
          @defaultValue={{false}}
          @onInput={{fn (mut this.iconOnly)}}
        />
        <Args.Bool
          @name="hasLogo"
          @value={{this.hasLogo}}
          @description="If true, alternative styling is applied to the image."
          @defaultValue={{false}}
          @onInput={{fn (mut this.hasLogo)}}
        />
        <Args.Array
          @name="participants"
          @type="Object"
          @items={{this.participants}}
          @description="Each Participant object may have 'title', 'role', 'imgURL', and 'type' fields."
          @onChange={{fn (mut this.participants)}}
        />
      </:api>
    </FreestyleUsage>

    <FreestyleUsage @slug="ParticipantKist-fanned" @description="In 'fanned' style">
      <:example>
        <BoxelParticipantList
          @participants={{this.participantsNoOrg}}
          @maxCount={{4}}
          @fanned={{true}}
        />
      </:example>
    </FreestyleUsage>
  </template>
}
