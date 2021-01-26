import Component from '@glimmer/component';
import { reads } from 'macro-decorators';

export default class ParticipantListComponent extends Component {
  @reads('args.iconSize', 30) iconSize;
  @reads('args.maxCount', 5) maxCount;
}
