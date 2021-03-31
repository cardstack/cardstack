import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { A } from '@ember/array';

import LolaSampsonThumb from '@cardstack/boxel/usage-support/images/users/Lola-Sampson.jpg';
import CardBot from '@cardstack/boxel/usage-support/images/orgs/cardbot.svg';

export default class ThreadMessageUsageComponent extends Component {
  @tracked imgURL = LolaSampsonThumb;
  @tracked content =
    'Hi Haley, Here’s your manuscript with all the edits I would recommend. Please review and let me know if you have any questions. I also added a couple tasks for you about things you should think about, as you figure out the rest of your story.';
  @tracked isRound = true;
  @tracked iconSize = '2.5rem';
  @tracked name = 'Lola Sampson';
  @tracked botImg = CardBot;
  @tracked messageArray = A([
    'Hello, it’s nice to see you!',
    'Let’s issue a Prepaid Card.',
    'First, you can choose the look and feel of your card, so that your customers and other users recognize that this Prepaid Card came from you.',
  ]);
  @tracked datetime = '2020-03-07T10:11';
}
