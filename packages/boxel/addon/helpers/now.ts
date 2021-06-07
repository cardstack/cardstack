import dayjs from 'dayjs';
import Helper from '@ember/component/helper';

export default Helper.helper(function compute() {
  return dayjs();
});
