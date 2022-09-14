/* eslint-disable @typescript-eslint/no-explicit-any */
import Helper from '@ember/component/helper';

interface PreventDefaultHelperSignature {
  Args: { Positional: [((event: Event) => void) | (() => void) | undefined] };
  Return: (event: Event) => void;
}

export default class PreventDefaultHelper extends Helper<PreventDefaultHelperSignature> {}
