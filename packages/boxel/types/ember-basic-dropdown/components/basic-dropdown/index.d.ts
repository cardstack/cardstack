/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable ember/no-empty-glimmer-component-classes */
import Component from '@glimmer/component';
import { ComponentLike } from '@glint/template';

// FIXME can these types be extracted from ember-basic-dropdown exports without using …/addon?
interface CalculatePositionOptions {
  horizontalPosition: string;
  verticalPosition: string;
  matchTriggerWidth: boolean;
  previousHorizontalPosition?: string;
  previousVerticalPosition?: string;
  renderInPlace: boolean;
  dropdown: any;
}
export type CalculatePositionResultStyle = {
  top?: number;
  left?: number;
  right?: number;
  width?: number;
  height?: number;
  [key: string]: string | number | undefined;
};
export type CalculatePositionResult = {
  horizontalPosition: string;
  verticalPosition: string;
  style: CalculatePositionResultStyle;
};
export type CalculatePosition = (
  trigger: Element,
  content: HTMLElement,
  destination: HTMLElement,
  options: CalculatePositionOptions
) => CalculatePositionResult;

interface Args {
  initiallyOpened?: boolean;
  renderInPlace?: boolean;
  verticalPosition?: string;
  horizontalPosition?: string;
  destination?: string;
  disabled?: boolean;
  dropdownId?: string;
  matchTriggerWidth?: boolean;
  onInit?: Function;
  registerAPI?: Function;
  onOpen?: Function;
  onClose?: Function;
  calculatePosition?: CalculatePosition;
}
export type BasicDropdownArgs = Args;

export type BasicDropdownTriggerArgs = {
  dropdown: Dropdown;
  eventType: 'click' | 'mousedown';
  stopPropagation: boolean;
  onBlur?: (dropdown?: Dropdown, event?: FocusEvent) => void;
  onClick?: (dropdown?: Dropdown, event?: MouseEvent) => void;
  onFocus?: (dropdown?: Dropdown, event?: FocusEvent) => void;
  onFocusIn?: (dropdown?: Dropdown, event?: FocusEvent) => void;
  onFocusOut?: (dropdown?: Dropdown, event?: FocusEvent) => void;
  onKeyDown?: (dropdown?: Dropdown, event?: KeyboardEvent) => void;
  onMouseDown?: (dropdown?: Dropdown, event?: MouseEvent) => void;
  onMouseEnter?: (dropdown?: Dropdown, event?: MouseEvent) => void;
  onMouseLeave?: (dropdown?: Dropdown, event?: MouseEvent) => void;
  onTouchEnd?: (dropdown?: Dropdown, event?: TouchEvent) => void;
};

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

interface BasicDropdownContentArgs {
  transitioningInClass?: string;
  transitionedInClass?: string;
  transitioningOutClass?: string;
  isTouchDevice?: boolean;
  destination: string;
  dropdown: Dropdown;
  renderInPlace: boolean;
  preventScroll?: boolean;
  rootEventType: 'click' | 'mousedown';
  top: string | undefined;
  left: string | undefined;
  right: string | undefined;
  width: string | undefined;
  height: string | undefined;
  otherStyles: Record<string, string>;
  onFocusIn?: (dropdown?: Dropdown, event?: FocusEvent) => void;
  onFocusOut?: (dropdown?: Dropdown, event?: FocusEvent) => void;
  onMouseEnter?: (dropdown?: Dropdown, event?: MouseEvent) => void;
  onMouseLeave?: (dropdown?: Dropdown, event?: MouseEvent) => void;
  shouldReposition: (
    mutations: MutationRecord[],
    dropdown: Dropdown
  ) => boolean;
}

export default class BasicDropdown extends Component<{
  Element: HTMLDivElement;
  Args: BasicDropdownArgs;
  Blocks: {
    default: [
      {
        Trigger: ComponentLike<{
          Element: HTMLDivElement;
          Args: Partial<BasicDropdownTriggerArgs>;
          Blocks: { default: [] };
        }>;
        Content: ComponentLike<{
          Element: HTMLDivElement;
          Args: Partial<BasicDropdownContentArgs>;
          Blocks: { default: [] };
        }>;
        actions: DropdownActions;
        uniqueId: Dropdown['uniqueId'];
        disabled: Dropdown['disabled'];
        isOpen: Dropdown['isOpen'];
      }
    ];
  };
}> {}
