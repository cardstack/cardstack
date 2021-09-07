import Component from '@glimmer/component';
import HaleyOConnellThumb from '@cardstack/boxel/usage-support/images/users/Haley-OConnell.jpg';
import JuliaMasonThumb from '@cardstack/boxel/usage-support/images/users/Julia-Mason.jpg';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { A } from '@ember/array';

const SAMPLE_PARTICIPANTS = [
  {
    title: 'Haley O’Connell',
    imgURL: HaleyOConnellThumb,
  },
  {
    title: 'Julia Mason',
    imgURL: JuliaMasonThumb,
  },
];

export default class extends Component {
  @tracked participants = A(SAMPLE_PARTICIPANTS);
  @tracked label = 'Customers';
  @tracked title = 'Purchase Order, Julia Mason';
  @tracked notificationCount = 1;
  @tracked workflowTitle = 'Prepaid Card Issuance';
  @tracked expanded = false;

  @action toggleExpand(): void {
    this.expanded = !this.expanded;
  }
}
