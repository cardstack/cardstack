import Helper from '@ember/component/helper';

class MenuDivider {
  type: string;
  constructor() {
    this.type = 'divider';
  }
}

interface MenuItemOptions {
  // eslint-disable-next-line @typescript-eslint/ban-types
  action: Function;
  url: string;
  dangerous: boolean;
  header: boolean;
  icon: string;
}
class MenuItem {
  text: string;
  type: string;
  dangerous: boolean;
  header: boolean;
  icon: string | undefined;
  // eslint-disable-next-line @typescript-eslint/ban-types
  action: Function | undefined;
  url: string | undefined;

  constructor(text: string, type: string, options: MenuItemOptions) {
    this.text = text;
    this.type = type;
    if (type === 'action') {
      this.action = options.action;
    } else if (type === 'url') {
      this.url = options.url;
    }
    this.dangerous = options.dangerous || false;
    this.header = options.header || false;
    this.icon = options.icon || undefined;
  }
}

export default Helper.helper(function (params, hash: MenuItemOptions) {
  let text = params[0];
  let opts = Object.assign({}, hash);
  if (params.length === 1 && /^-+$/.test(text)) {
    return new MenuDivider();
  }
  if (params.length === 1 && opts.url) {
    return new MenuItem(text, 'url', opts);
  }
  opts.action = params[1];
  return new MenuItem(text, 'action', opts);
});
