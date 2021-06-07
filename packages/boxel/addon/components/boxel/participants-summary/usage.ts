import Component from '@glimmer/component';
import { A } from '@ember/array';
import { tracked } from '@glimmer/tracking';
import { Participant } from './index';

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

export default class extends Component {
  @tracked participants = A(SAMPLE_PARTICIPANTS);
}
