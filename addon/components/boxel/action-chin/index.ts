import Component from '@glimmer/component';
import { equal, reads } from 'macro-decorators';

export default class ActionChin extends Component {
  @reads('args.mode', 'data-entry') declare mode: string;
  @equal('mode', 'data-entry') declare isDataEntryMode: boolean;
  @equal('mode', 'memorialized') declare isMemorializedMode: boolean;
}
