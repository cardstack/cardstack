import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelParticipantSummary from './index';
import DarkThemeAndLightTheme from 'dummy/components/doc/dark-theme-and-light-theme';
import { A } from '@ember/array';
import { tracked } from '@glimmer/tracking';
import { type Participant } from '../participant/model';
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
] as Partial<Participant>[];

export default class ParticipantsSummaryUsage extends Component {
  @tracked participants: Partial<Participant>[] = A(SAMPLE_PARTICIPANTS);
  <template>
    <FreestyleUsage @name="ParticipantsSummary">
      <:example>
        <DarkThemeAndLightTheme>
          <BoxelParticipantSummary
            @participants={{this.participants}}
          />
        </DarkThemeAndLightTheme>
      </:example>
      <:api as |Args|>
        <Args.Array
          @name="participants"
          @type="Object"
          @items={{this.participants}}
          @description="Each Participant object may have 'title', 'role', 'imgURL', and 'type' fields."
          @onChange={{fn (mut this.participants)}}
        />
      </:api>
    </FreestyleUsage>
  </template>
}
