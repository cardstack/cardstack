import Controller from '@ember/controller';

export default class ApplicationController extends Controller {}

declare module '@ember/controller' {
  interface Registry {
    application: ApplicationController;
  }
}
