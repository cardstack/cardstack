import '@glint/environment-ember-loose';

import type BoxelButton from '@cardstack/boxel/components/boxel/button';
import type BoxelActionChin from '@cardstack/boxel/components/boxel/action-chin';

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::ActionChin': typeof BoxelActionChin;
    'Boxel::Button': typeof BoxelButton;
  }
}
