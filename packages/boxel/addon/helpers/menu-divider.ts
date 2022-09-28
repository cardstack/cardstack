import Helper from '@ember/component/helper';

export class MenuDivider {
  type: string;
  constructor() {
    this.type = 'divider';
  }
}

export default Helper.helper(function (): MenuDivider {
  return new MenuDivider();
});
