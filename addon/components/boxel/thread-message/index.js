import Component from '@glimmer/component';
import { reads, not } from 'macro-decorators';

export default class ThreadMessageComponent extends Component {
  @reads('args.iconSize', '2.5rem') iconSize;
  @not('args.isRound') hasLogo;
}
