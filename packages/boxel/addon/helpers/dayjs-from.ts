import dayjs from 'dayjs';
import Helper from '@ember/component/helper';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export default Helper.helper(function compute(
  [datetime, relativeTo, paramWithoutSuffix]: [
    dayjs.ConfigType,
    dayjs.ConfigType | undefined,
    boolean | undefined
  ],
  { withoutSuffix }: { withoutSuffix: boolean | undefined }
) {
  return dayjs(datetime).from(
    relativeTo || dayjs(),
    paramWithoutSuffix || withoutSuffix
  );
});
