import dayjs from 'dayjs';
import Helper from '@ember/component/helper';

export default Helper.helper(function (
  params,
  {
    precision,
    float,
  }: { precision: dayjs.OpUnitType | dayjs.OpUnitType; float: boolean }
) {
  if (!params || (params && params.length !== 2)) {
    throw new TypeError('dayjs-diff: Invalid Number of arguments, must be 2');
  }

  const [dateA, dateB] = params;

  return dayjs(dateB).diff(dateA, precision, float);
});
