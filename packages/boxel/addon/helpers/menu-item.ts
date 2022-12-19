import { helper } from '@ember/component/helper';
import { type Link } from 'ember-link';

// eslint-disable-next-line @typescript-eslint/ban-types
type ActionType = Link | Function;

interface MenuItemOptions {
  action: ActionType;
  url: string;
  dangerous: boolean;
  header: boolean;
  icon: string;
  inactive: boolean;
  selected: boolean;
  disabled: boolean;
  tabindex: number | string;
  id?: string;
}
export class MenuItem {
  text: string;
  type: string;
  dangerous: boolean;
  selected: boolean;
  disabled: boolean;
  header: boolean;
  icon: string | undefined;
  action: ActionType | undefined;
  url: string | undefined;
  inactive: boolean | undefined;
  tabindex: number | string | undefined;
  id?: string;

  constructor(text: string, type: string, options: Partial<MenuItemOptions>) {
    this.text = text;
    this.type = type;
    this.action = options.action;
    this.id = options.id;
    this.dangerous = options.dangerous || false;
    this.selected = options.selected || false;
    this.disabled = options.disabled || false;
    this.header = options.header || false;
    this.icon = options.icon || undefined;
    this.inactive = options.inactive;
    this.tabindex = options.tabindex || 0;
  }
}

export function menuItemFunc(
  params: [string, ActionType],
  named: Partial<MenuItemOptions>
): MenuItem {
  let text = params[0];
  let opts = Object.assign({}, named);
  opts.action = params[1];
  return new MenuItem(text, 'action', opts);
}

export default helper(menuItemFunc);
