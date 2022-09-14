import Helper from '@ember/component/helper';
import { type Link } from 'ember-link';

type ActionType = Link | (() => void);

interface MenuItemOptions {
  action: ActionType;
  url: string;
  dangerous: boolean;
  header: boolean;
  icon: string;
  inactive: boolean;
}
export class MenuItem {
  text: string;
  type: string;
  dangerous: boolean;
  header: boolean;
  icon: string | undefined;
  action: ActionType;
  url: string | undefined;
  inactive: boolean;

  constructor(text: string, type: string, options: MenuItemOptions) {
    this.text = text;
    this.type = type;
    this.action = options.action;
    this.dangerous = options.dangerous || false;
    this.header = options.header || false;
    this.icon = options.icon || undefined;
    this.inactive = options.inactive;
  }
}

export default Helper.helper(function (
  params: [string, ActionType],
  hash: MenuItemOptions
): MenuItem {
  let text = params[0];
  let opts = Object.assign({}, hash);
  opts.action = params[1];
  return new MenuItem(text, 'action', opts);
});
