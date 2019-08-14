import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class ToolsRoute extends Route {
  @service boxel;

  renderTemplate(/*controller, model*/) {
    this.render('tools', {
      into: 'application',
      outlet: 'tools'
    });
  }
}
