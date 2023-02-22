/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable ember/no-empty-glimmer-component-classes */

// FIXME can these types be extracted from ember-power-select exports without using …/addon?

import Component from '@glimmer/component';
import { ComponentLike } from '@glint/template';

type RepositionChanges = {
  hPosition: string;
  vPosition: string;
  otherStyles: Record<string, string | number | undefined>;
  top?: string;
  left?: string;
  right?: string;
  width?: string;
  height?: string;
};

interface DropdownActions {
  toggle: (e?: Event) => void;
  close: (e?: Event, skipFocus?: boolean) => void;
  open: (e?: Event) => void;
  reposition: (...args: any[]) => undefined | RepositionChanges;
}
interface Dropdown {
  uniqueId: string;
  disabled: boolean;
  isOpen: boolean;
  actions: DropdownActions;
}

type MatcherFn = (option: any, text: string) => number;

interface SelectActions extends DropdownActions {
  search: (term: string) => void;
  highlight: (option: any) => void;
  select: (selected: any, e?: Event) => void;
  choose: (selected: any, e?: Event) => void;
  scrollTo: (option: any) => void;
}

export interface Select extends Dropdown {
  selected: any;
  highlighted: any;
  options: any[];
  results: any[];
  resultsCount: number;
  loading: boolean;
  isActive: boolean;
  searchText: string;
  lastSearchedText: string;
  actions: SelectActions;
}
interface PromiseProxy<T> extends Promise<T> {
  content: any;
}

export interface PowerSelectArgs {
  highlightOnHover?: boolean;
  placeholderComponent?: string;
  searchMessage?: string;
  searchMessageComponent?: string;
  noMatchesMessage?: string;
  noMatchesMessageComponent?: string;
  matchTriggerWidth?: boolean;
  selectedItemComponent?: string | ComponentLike;
  options: any[] | PromiseProxy<any[]>;
  selected: any | PromiseProxy<any>;
  closeOnSelect?: boolean;
  defaultHighlighted?: any;
  searchField?: string;
  searchEnabled?: boolean;
  tabindex?: number | string;
  beforeOptionsComponent?: string | ComponentLike<BeforeOptionsArgs>;
  triggerComponent?: string;
  optionsComponent?: string;
  groupComponent?: string;
  matcher?: MatcherFn;
  initiallyOpened?: boolean;
  typeAheadOptionMatcher?: MatcherFn;
  placeholder?: string;
  renderInPlace?: boolean;
  verticalPosition?: 'auto' | 'below' | 'above';
  dropdownClass?: string;
  disabled?: boolean;
  eventType?: 'click' | 'mousedown';
  buildSelection?: (selected: any, select: Select) => any;
  onChange: (selection: any, select: Select, event?: Event) => void;
  search?: (term: string, select: Select) => any[] | PromiseProxy<any[]>;
  onOpen?: (select: Select, e: Event) => boolean | undefined;
  onClose?: (select: Select, e: Event) => boolean | undefined;
  onInput?: (term: string, select: Select, e: Event) => string | false | void;
  onKeydown?: (select: Select, e: KeyboardEvent) => boolean | undefined;
  onFocus?: (select: Select, event: FocusEvent) => void;
  onBlur?: (select: Select, event: FocusEvent) => void;
  scrollTo?: (option: any, select: Select) => void;
  registerAPI?: (select: Select) => void;
}

import {
  BasicDropdownArgs,
  BasicDropdownTriggerArgs,
} from 'ember-basic-dropdown/components/basic-dropdown';

interface BeforeOptionsArgs {
  select: Select;
  onKeydown: (e: Event) => false | void;
  autofocus?: boolean;
}
export class BeforeOptions extends Component<BeforeOptionsArgs> {
  clearSearch(): void;
  handleKeydown(e: KeyboardEvent): false | void;
  focusInput(el: HTMLElement): void;
}

type SharedDropdownType = Pick<
  BasicDropdownArgs,
  'renderInPlace' | 'disabled'
> &
  Partial<Pick<BasicDropdownTriggerArgs, 'eventType'>>;

export interface PatchedPowerSelectArgs
  extends PowerSelectArgs,
    SharedDropdownType {
  verticalPosition?: 'auto' | 'below' | 'above';
  dropdownClass?: string;
  placeholder?: string;
  selectedItemComponent?: string | ComponentLike;
}

export default class PowerSelect extends Component<{
  Element: HTMLDivElement;
  Args: PowerSelectArgs;
  // TODO: figure out property types for default block
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Blocks: { default: [any, any] };
}> {}
