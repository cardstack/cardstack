import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import OverlaysService from '../services/overlays';

export default class ApplicationController extends Controller {
  @service overlays!: OverlaysService;
}
