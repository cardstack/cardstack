import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import ProfileService from '../services/profile';

export default class ApplicationController extends Controller {
  @service('profile') declare profile: ProfileService;
}
