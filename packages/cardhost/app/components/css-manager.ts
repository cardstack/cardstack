import Component from '@glimmer/component';
import CssService, { CssEntry } from '../services/css';
import { inject as service } from '@ember/service';

export default class CssManager extends Component {
  @service css!: CssService;

  get cssEntries(): [string, CssEntry][] {
    return [...this.css.cssMap.entries()];
  }

  cardEntryMap(entry: CssEntry['cards'][0]) {
    return entry.canonicalURL;
  }
}
