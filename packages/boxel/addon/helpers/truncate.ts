import { helper } from '@ember/component/helper';
import { isHTMLSafe } from '@ember/template';

type PositionalArgs = [
  s?: string,
  characterLimit?: number,
  useEllipsis?: boolean
];

interface Signature {
  Args: {
    Positional: PositionalArgs;
  };
  Return: string;
}

export function truncate([
  s,
  characterLimit = 140,
  useEllipsis = true,
]: PositionalArgs): string {
  let limit = useEllipsis ? characterLimit - 3 : characterLimit;

  if (!s) {
    return '';
  }

  if (isHTMLSafe(s)) {
    s = s.toString();
  }

  if (s && s.length > limit) {
    return useEllipsis ? `${s.substring(0, limit)}...` : s.substring(0, limit);
  } else {
    return s;
  }
}

export default helper<Signature>(truncate);
