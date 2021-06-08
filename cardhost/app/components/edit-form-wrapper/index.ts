import Component from '@glimmer/component';
import { action } from '@ember/object';
import { set } from '@ember/object';

import { LoadedCard } from '../../services/cards';

interface EditFormWrapperArgs {
  card: LoadedCard;
}

export default class EditFormWrapper extends Component<EditFormWrapperArgs> {
  @action set(segments: string[], value: InputEvent): void {
    set(this.args.card.model, segments.join('.'), value);
  }
}
