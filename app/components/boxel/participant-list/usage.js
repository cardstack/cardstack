import Component from '@glimmer/component';
import HaleyOConnellThumb from '../../../images/workflow/participants/thumb/Haley-OConnell.jpg';
import JuliaMasonThumb from '../../../images/workflow/participants/thumb/Julia-Mason.jpg';
import LolaSampsonThumb from '../../../images/workflow/participants/thumb/Lola-Sampson.jpg';
import RupertGrishamThumb from '../../../images/workflow/participants/thumb/Rupert-Grisham.jpg';
import HSHIcon from '../../../images/workflow/orgs/hsh-icon.png';
import { tracked } from '@glimmer/tracking';
import { A } from '@ember/array';

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
  @tracked iconSize = 30;
  @tracked maxCount = 5;
  @tracked fanned = false;
  @tracked iconOnly = false;
  @tracked hasLogo = false;
}
