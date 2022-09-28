import dayjs from 'dayjs';
import { helper } from '@ember/component/helper';

const DEFAULT_LOCALE = 'en';
const DEFAULT_OUTPUT_FORMAT = 'D MMMM, YYYY';

export interface Signature {
  Args: {
    Positional: Array<unknown>;
    Named: { locale?: string };
  };
  Return: string;
}

export function dayjsFormat(
  date: dayjs.ConfigType,
  formatString: string = DEFAULT_OUTPUT_FORMAT,
  locale: string = DEFAULT_LOCALE,
  option?: dayjs.OptionType
): string {
  if (option) {
    return dayjs(date, option).locale(locale).format(formatString);
  } else {
    return dayjs(date).locale(locale).format(formatString);
  }
}

export default helper<Signature>(function computed(
  positional: unknown[],
  hash: { locale?: string }
) {
  return dayjsFormat(
    positional[0] as dayjs.ConfigType,
    positional[1] as string,
    hash.locale,
    positional[3] as dayjs.OptionType | undefined
  );
});
