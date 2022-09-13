import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { A } from '@ember/array';
import { action } from '@ember/object';
import './usage.css';

import LolaSampsonThumb from '@cardstack/boxel/usage-support/images/users/Lola-Sampson.jpg';
import CardBot from '@cardstack/boxel/usage-support/images/orgs/cardbot.svg';

export default class ThreadMessageUsage extends Component {
  cardbotIcon = CardBot;
  @tracked name = 'Lola Sampson';
  @tracked imgURL = LolaSampsonThumb;
  @tracked datetime = '2020-03-07T10:11';
  @tracked notRound = false;
  @tracked hideMeta = false;
  @tracked hideName = false;
  @tracked messageArray = A([
    'Hello, it’s nice to see you!',
    'Let’s issue a Prepaid Card.',
    'First, you can choose the look and feel of your card, so that your customers and other users recognize that this Prepaid Card came from you.',
  ]);
  @tracked fullWidth = false;

  @tracked avatarSize = '2.5rem';
  @tracked metaHeight = '1.25rem';
  @tracked gap = 'var(--boxel-sp)';
  @tracked marginLeft =
    'calc(var(--boxel-thread-message-avatar-size) + var(--boxel-thread-message-gap))';

  @tracked layoutExampleFullWidth = false;
  @action toggleLayoutExampleFullWidth(): void {
    this.layoutExampleFullWidth = !this.layoutExampleFullWidth;
  }
  @tracked isComplete = false;
  @action toggleIsComplete(): void {
    this.isComplete = !this.isComplete;
  }
}
