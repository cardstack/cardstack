import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';

export default class Delegate extends Controller {
  queryParams = ['url'];

  @tracked url: string | undefined;
}
