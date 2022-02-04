/* eslint-disable no-console */
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class extends Component {
  @tracked ctaText: string | undefined;
  @tracked prompt: string | undefined;
  @tracked url = 'mailto:support@cardstack.com';
}
