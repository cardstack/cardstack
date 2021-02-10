import Component from '@glimmer/component';
import { equal, reads } from 'macro-decorators';

export default class ActionChin extends Component {
  @reads('args.mode', 'data-entry') mode;
  @equal('mode', 'data-entry') isDataEntryMode;
  @equal('mode', 'memorialized') isMemorializedMode;
}
