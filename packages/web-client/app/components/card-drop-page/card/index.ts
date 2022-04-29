import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import UA from '@cardstack/web-client/services/ua';

export default class CardDropPageCardComponent extends Component {
  @service('ua') declare ua: UA;
}
