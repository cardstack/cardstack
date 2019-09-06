import Route from '@ember/routing/route';
import { hubURL } from '@cardstack/plugin-utils/environment';
import { ciSessionId } from '@cardstack/test-support/environment';
import { action } from '@ember/object';

export default class UpdateCardRoute extends Route {
  async model({ id }) {
    let response = await fetch(`${hubURL}/api/cards/${id}?format=isolated`, {
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${ciSessionId}`
      },
    });
    if (response.ok) {
      return { id, card: await response.json() };
    }
    return { id };
  }

  @action
  refreshCard() {
    this.refresh();
  }
}