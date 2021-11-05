import Component from '@glimmer/component';
import { reads } from 'macro-decorators';
import '@cardstack/boxel/styles/global.css';
import './index.css';

export default class ParticipantComponent extends Component {
  @reads('args.iconSize', '2rem') declare iconSize: string;
}
