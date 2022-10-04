import { helper } from '@ember/component/helper';
import { type EmptyObject } from '@ember/component/helper';

interface Signature {
  Args: {
    Positional: [];
    Named: EmptyObject;
  };
  Return: MenuDivider;
}
export class MenuDivider {
  type: string;
  constructor() {
    this.type = 'divider';
  }
}

export default helper<Signature>(function (): MenuDivider {
  return new MenuDivider();
});
