import Component from '@glimmer/component';
import { inject } from '@ember/service';
import ModalService from 'cardhost/services/modal';
import type RouterService from '@ember/routing/router-service';
import { CardModel } from '@cardstack/core/src/interfaces';
import { LOCAL_REALM, DEMO_REALM } from 'cardhost/lib/builder';
import './index.css';

interface CardContainerArgs {
  card?: CardModel;
  editable?: boolean;
}

export default class CardContainer extends Component<CardContainerArgs> {
  @inject declare modal: ModalService;
  @inject declare router: RouterService;

  // This is hardcoded for now. We need to decide how this should work.
  REALM = DEMO_REALM;
  LOCAL_REALM = LOCAL_REALM;
}
