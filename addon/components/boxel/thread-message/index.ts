import Component from '@glimmer/component';
import { reads, not } from 'macro-decorators';

export default class ThreadMessageComponent extends Component {
  @reads('args.iconSize', '2.5rem') declare iconSize: string;
  @not('args.isRound') declare hasLogo: boolean;
}
