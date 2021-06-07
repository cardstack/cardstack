import dayjs from 'dayjs';
import Helper from '@ember/component/helper';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export default Helper.helper(function compute(
  [datetime, relativeTo, paramWithoutSuffix],
  { withoutSuffix }: { withoutSuffix: boolean | undefined }
) {
  return dayjs(datetime).from(
    relativeTo || dayjs(),
    paramWithoutSuffix || withoutSuffix
  );
});
