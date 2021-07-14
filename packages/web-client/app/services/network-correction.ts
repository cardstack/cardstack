import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import Layer1Network from './layer1-network';
import Layer2Network from './layer2-network';

export default class NetworkCorrection extends Service {
  @service('layer1-network') declare layer1Network: Layer1Network;
  @service('layer2-network') declare layer2Network: Layer2Network;

  // this property will be used to determine not just whether we need to reload,
  // but whether we need to prevent the user from performing any actions in the UI
  @tracked needsReload = false;

  // track these separately from needsReload because these should provide hints to the ui
  // about what messages to display to the user (what networks should you change?)
  // we might want a clause in the component that displays the messages that says that
  // if you disconnect, you need to reload yourself.
  @tracked layer1Incorrect = false;
  @tracked layer2Incorrect = false;

  @action
  onLayer1Incorrect() {
    console.log('incorrect chain detected');
    let layer1PreviouslyIncorrect = this.layer1Incorrect;
    this.needsReload = true;
    this.layer1Incorrect = true;
    if (!layer1PreviouslyIncorrect) {
      this.informUser();
    }
  }

  @action
  onLayer1Correct() {
    console.log('correct chain detected');
    this.layer1Incorrect = false;
    this.maybeReload();
  }

  @action
  onLayer2Incorrect() {
    let layer2PreviouslyIncorrect = this.layer2Incorrect;
    this.needsReload = true;
    this.layer2Incorrect = true;
    if (!layer2PreviouslyIncorrect) {
      this.informUser();
    }
  }

  @action
  onLayer2Correct() {
    // change this to also include layer 2
    this.layer2Incorrect = false;
    this.maybeReload();
  }

  informUser() {
    console.log(
      'show a modal that tells the user that they are on the wrong chain(s) and that they need to change chains, and reload the page'
    );
  }

  maybeReload() {
    if (!this.needsReload) {
      console.log('do not need to reload via service');
      return;
    }

    // there might be a condition with disconnections later
    let layer1ReadyForReload = !this.layer1Incorrect;
    let layer2ReadyForReload = !this.layer2Incorrect;

    if (!layer1ReadyForReload && !layer2ReadyForReload) {
      console.error('Both networks are not ready for reload');
    } else if (!layer1ReadyForReload) {
      console.error('Layer 1 is not ready for reload');
    } else if (!layer2ReadyForReload) {
      console.error('Layer 2 is not ready for reload');
    } else {
      console.log('reloading via service');
    }
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'network-correction': NetworkCorrection;
  }
}
