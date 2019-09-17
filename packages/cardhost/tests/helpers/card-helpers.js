import { click, visit, waitFor } from '@ember/test-helpers';
import { setCodeMirrorValue } from './code-mirror';

export async function createCard(card) {
  await visit('/cards/new');
  if (card) {
    setCodeMirrorValue(JSON.stringify(card, null, 2));
  }
  await click('[data-test-card-creator-add-btn]');
  await waitFor(`[data-test-card-updator="${card.data.id}"]`);
}