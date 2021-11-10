import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import Component from '@glimmer/component';
import CardBot from '@cardstack/boxel/usage-support/images/orgs/cardbot.svg';
import User from '@cardstack/boxel/usage-support/images/users/Gary-Walker.jpg';
import './usage.css';

const USER = {
  title: 'Gary Walker',
  imgURL: User,
};

const BOT = {
  title: 'Cardbot',
  imgURL: CardBot,
};

const USER_GROUP = [USER];

const ORG_GROUP = [BOT];

const MILESTONES = [
  {
    title: 'Milestone 1',
    statusOnCompletion: 'Milestone 1 completed',
    senderIcon: BOT.imgURL,
    message: ['Hello, it’s nice to see you!'],
  },
  {
    title: 'Milestone 2',
    statusOnCompletion: 'Milestone 2 completed',
  },
  {
    title: 'Milestone 3',
    statusOnCompletion: 'Milestone 3 completed',
  },
];

export default class ThreadMessageUsageComponent extends Component {
  cardBotIcon = CardBot;
  orgGroup = ORG_GROUP;
  userGroup = USER_GROUP;
  milestones = MILESTONES;
  @tracked messages: number[] = [1];
  @tracked autoscroll = false;

  @action addMessage(): void {
    this.messages = [...this.messages, 1];
  }
}
