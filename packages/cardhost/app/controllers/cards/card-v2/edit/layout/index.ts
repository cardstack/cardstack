import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
// @ts-ignore
import { task } from 'ember-concurrency';
import { Router } from '@ember/routing';
import { CardstackSession } from '../../../../../services/cardstack-session';
import { isolatedCssFile } from '../../../../../utils/scaffolding';
import { Model } from '../../../../../routes/cards/card-v2';
import EditCardV2Controller from '../../edit';

export interface ThemeOption {
  name: string;
}

export default class CardLayoutIndexController extends EditCardV2Controller {
  @service cssModeToggle!: { visible: boolean; dockLocation: 'right' | 'bottom'; isResponsive: boolean };
  @service router!: Router;
  @service cardstackSession!: CardstackSession;
  resizeable = true;

  @tracked
  themerOptions: ThemeOption[] = [{ name: 'Cardstack default' }, { name: 'Custom theme' }];

  @action
  createTheme() {
    this.router.transitionTo('cards.card-v2.edit.layout.themer', this.model);
  }

  get selectedTheme(): ThemeOption {
    // Note that this is not really the "Cardstack default", but rather, it's
    // the inherited style which means that you have not created a card-specific
    // customization. This wording probably needs to be cleaned up...
    let name = this.model.card.csFiles?.[isolatedCssFile] ? 'Custom theme' : 'Cardstack default';
    return { name };
  }

  @(task(function*(this: CardLayoutIndexController, val: ThemeOption) {
    if (val.name !== 'Cardstack default') {
      return;
    }
    let { card } = this.model as Model;
    let { csFiles, csFeatures } = card;
    let doc = card.document;
    if (csFeatures) {
      delete csFeatures['isolated-css'];
      doc.withAttributes({ csFeatures });
    }
    if (csFiles) {
      delete csFiles[isolatedCssFile];
      doc.withAttributes({ csFiles });
    }

    if (csFiles || csFeatures) {
      let patchedCard = yield card.patch(doc.jsonapiWithoutMeta);
      this.send('updateCardModel', patchedCard, true);
    }
  }).restartable())
  handleThemeChange: any;
}
