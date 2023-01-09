import { helper } from '@ember/component/helper';
import { format } from 'date-fns';

type PositionalArgs = [Date, string];

interface Signature {
  Args: {
    Positional: PositionalArgs;
  };
  Return: string;
}

export function formatDate([date, dateFormat]: PositionalArgs) {
  return format(date, dateFormat);
}

export default helper<Signature>(formatDate);
