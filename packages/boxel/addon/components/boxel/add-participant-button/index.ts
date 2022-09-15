import templateOnlyComponent from '@ember/component/template-only';
import '@cardstack/boxel/styles/global.css';
import './index.css';
import { type EmptyObject } from '@ember/component/helper';

interface Signature {
  Element: HTMLButtonElement;
  Args: EmptyObject;
  Blocks: EmptyObject;
}

const AddParticipantButton = templateOnlyComponent<Signature>();
export default AddParticipantButton;

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::AddParticipantButton': typeof AddParticipantButton;
  }
}
