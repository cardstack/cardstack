import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import fade from 'ember-animated/transitions/fade';

export default class ApplicationController extends Controller {
  @service overlays;

  fade = fade;
}
