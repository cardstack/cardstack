/* eslint-disable no-console */
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class LoadingIndicatorUsage extends Component {
  @tracked color = '#000';
}
