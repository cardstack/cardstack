import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
// @ts-ignore
import { task } from 'ember-concurrency';
import RouterService from '@ember/routing/router-service';
import { CardstackSession } from '../../../../../services/cardstack-session';
import { isolatedCssFile } from '../../../../../utils/scaffolding';
import { Model } from '../../../../../routes/cards/card';
import EditCardController from '../../edit';
import { Card } from '@cardstack/core/card';

export interface ThemeOption {
  name: string;
}

export default class CardLayoutIndexController extends EditCardController {
  @service autosave!: {
    saveCard: any; // this is actually a task which is really hard to describe in TS
    cardUpdated: (card: Card, isDirty: boolean) => void;
  };
  @service cssModeToggle!: { visible: boolean; dockLocation: 'right' | 'bottom'; isResponsive: boolean };
  @service router!: RouterService;
  @service cardstackSession!: CardstackSession;
  resizeable = true;

  @tracked
  themerOptions: ThemeOption[] = [{ name: 'Template theme' }, { name: 'Custom theme' }];

  get isDefault(): boolean {
    return !this.model.card.csFiles?.[isolatedCssFile];
  }

  @action
  createTheme() {
    this.router.transitionTo('cards.card.edit.layout.themer', this.model);
  }

  get selectedTheme(): ThemeOption {
    let name = this.isDefault ? 'Template theme' : 'Custom theme';
    return { name };
  }

  @(task(function*(this: CardLayoutIndexController, val: ThemeOption) {
    if (this.autosave.saveCard.last) {
      yield this.autosave.saveCard.last.then();
    }

    if (val.name !== 'Template theme') {
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
      this.autosave.cardUpdated(patchedCard, true);
    }
  }).restartable())
  handleThemeChange: any;
}
