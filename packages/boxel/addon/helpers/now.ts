import dayjs from 'dayjs';
import { helper } from '@ember/component/helper';

interface Signature {
  Args: {
    Positional: [];
  };
  Return: ReturnType<typeof dayjs>;
}
export default helper<Signature>(function compute() {
  return dayjs();
});
