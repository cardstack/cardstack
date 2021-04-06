import Helper from '@ember/component/helper';

class MenuDivider {
  constructor() {
    this.type = 'divider';
  }
}

class MenuItem {
  constructor(text, type, options) {
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

export default Helper.helper(function (params, hash) {
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
