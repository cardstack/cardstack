import Helper from '@ember/component/helper';

interface NoopHelperSignature {
  Args: { Positional: string[] };
  Return: () => void;
}

export default class NoopHelper extends Helper<NoopHelperSignature> {}
