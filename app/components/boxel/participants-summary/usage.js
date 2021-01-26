import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import HaleyOConnellThumb from '../../../images/workflow/participants/thumb/Haley-OConnell.jpg';
import JuliaMasonThumb from '../../../images/workflow/participants/thumb/Julia-Mason.jpg';
import LolaSampsonThumb from '../../../images/workflow/participants/thumb/Lola-Sampson.jpg';
import RupertGrishamThumb from '../../../images/workflow/participants/thumb/Rupert-Grisham.jpg';
import HSHIcon from '../../../images/workflow/orgs/hsh-icon.png';

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
export default class extends Component {
  @tracked numParticipants = 2;
  get participants() {
    return SAMPLE_PARTICIPANTS.slice(0, this.numParticipants);
  }
}
