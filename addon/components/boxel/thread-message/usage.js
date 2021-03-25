import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { A } from '@ember/array';

import LolaSampsonThumb from '@cardstack/boxel/usage-support/images/users/Lola-Sampson.jpg';
import HSHIcon from '@cardstack/boxel/usage-support/images/orgs/hsh-icon.png';

export default class ThreadMessageUsageComponent extends Component {
  HSHIcon = HSHIcon;
  LolaSampsonThumb = LolaSampsonThumb;
  @tracked contents = A([
    'Hello, it’s nice to see you!',
    'Let’s issue a Prepaid Card.',
    'First, you can choose the look and feel of your card, so that your customers and other users recognize that this Prepaid Card came from you.',
  ]);
  @tracked content = null;
  @tracked hasLogo = false;
  @tracked iconSize = 40;
  @tracked datetime = '2020-03-07T10:11';
}
