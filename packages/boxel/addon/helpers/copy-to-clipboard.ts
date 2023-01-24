import { helper } from '@ember/component/helper';

type PositionalArgs = [];
type NamedArgs = {
  elementId?: string;
  value?: string;
  onCopy?: () => void;
};

interface Signature {
  Args: {
    Positional: PositionalArgs;
    Named: NamedArgs;
  };
  Return: () => void;
}

export function copyToClipboard(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _params: PositionalArgs,
  { elementId, value, onCopy }: NamedArgs
): () => void {
  return function () {
    let sourceInput = document.querySelector(`#${elementId}`) as
      | HTMLInputElement
      | undefined;
    if (sourceInput) {
      sourceInput.select();
      document.execCommand('copy');
      onCopy?.();
    } else if (value) {
      navigator.clipboard.writeText(value);
      onCopy?.();
    } else {
      console.warn(`copyToClipboard: element not found with id ${elementId}`);
    }
  };
}

export default helper<Signature>(copyToClipboard);
