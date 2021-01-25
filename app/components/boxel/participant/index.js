import Component from '@glimmer/component';
import { reads } from 'macro-decorators';
import "./style.css";

export default class ParticipantComponent extends Component {
  @reads('args.iconSize', 30) iconSize;
}
