import Component from '@glimmer/component';
import { reads } from 'macro-decorators';
import '@cardstack/boxel/styles/global.css';
import './index.css';

export default class ParticipantListComponent extends Component {
  @reads('args.iconSize', '2rem') declare iconSize: string;
  @reads('args.maxCount', 5) declare maxCount: number;
}
