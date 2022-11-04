import { DropdownAPI } from '../../dropdown';

export type KeyboardFocus = 'none' | 'hour' | 'minute' | 'meridian';

export interface KeyboardControllableTimeComponent {
  keyboardFocus: KeyboardFocus;
  dropdownAPI?: DropdownAPI;
  recentString?: string;
  setMeridian(newMeridian: 'am' | 'pm'): void;
  decrementHour(): void;
  incrementHour(): void;
  decrementMinute(): void;
  incrementMinute(): void;
  toggleMeridian(): void;
  updateHourFromNumericInput(numString: string): void;
  updateMinuteFromNumericInput(numString: string): void;
}

export interface KeyboardHandler {
  handle(ev: KeyboardEvent): void;
}

abstract class BaseKeyboardHandler implements KeyboardHandler {
  component: KeyboardControllableTimeComponent;

  constructor(component: KeyboardControllableTimeComponent) {
    this.component = component;
  }

  handle(ev: KeyboardEvent): void {
    let unhandled = false;
    let handlerMethodName = `on${ev.code}`;
    //@ts-expect-error dynamic method lookup
    let handlerMethod = this[handlerMethodName];
    if (handlerMethod) {
      handlerMethod.call(this);
    } else if (/^Digit[0-9]$/.test(ev.code)) {
      this.onNumberKey(ev);
    } else {
      unhandled = true;
    }
    if (!unhandled) {
      ev.stopPropagation();
      ev.preventDefault();
    }
  }

  onEnter() {
    this.component.dropdownAPI?.actions?.close();
  }

  onKeyA() {
    this.component.keyboardFocus = 'meridian';
    this.component.setMeridian('am');
  }

  onKeyP() {
    this.component.keyboardFocus = 'meridian';
    this.component.setMeridian('pm');
  }

  abstract onNumberKey(ev: KeyboardEvent): void;
}

export class NoneFocusKeyboardHandler extends BaseKeyboardHandler {
  onArrowUp(): void {
    this.component.keyboardFocus = 'hour';
    this.component.decrementHour();
  }
  onArrowDown(): void {
    this.component.keyboardFocus = 'hour';
    this.component.incrementHour();
  }
  onArrowLeft(): void {
    this.component.keyboardFocus = 'hour';
  }
  onArrowRight(): void {
    this.component.keyboardFocus = 'hour';
  }
  onNumberKey(ev: KeyboardEvent): void {
    this.component.keyboardFocus = 'hour';
    let numString = ev.code.replace('Digit', '');
    this.component.updateHourFromNumericInput(numString);
  }
}

export class HourFocusKeyboardHandler extends BaseKeyboardHandler {
  handle(ev: KeyboardEvent): void {
    if (ev.code === 'Semicolon' && ev.shiftKey) {
      ev.stopPropagation();
      ev.preventDefault();
      this.onColon();
    } else {
      super.handle(ev);
    }
  }
  onArrowUp(): void {
    this.component.decrementHour();
  }
  onArrowDown(): void {
    this.component.incrementHour();
  }
  onArrowLeft(): void {
    // no-op
  }
  onArrowRight(): void {
    this.component.keyboardFocus = 'minute';
  }
  onColon(): void {
    this.component.keyboardFocus = 'minute';
  }
  onNumberKey(ev: KeyboardEvent): void {
    let numString = ev.code.replace('Digit', '');
    this.component.updateHourFromNumericInput(numString);
  }
}

export class MinuteFocusKeyboardHandler extends BaseKeyboardHandler {
  onArrowUp(): void {
    this.component.decrementMinute();
  }
  onArrowDown(): void {
    this.component.incrementMinute();
  }
  onArrowLeft(): void {
    this.component.keyboardFocus = 'hour';
  }
  onArrowRight(): void {
    this.component.keyboardFocus = 'meridian';
  }
  onNumberKey(ev: KeyboardEvent): void {
    let numString = ev.code.replace('Digit', '');
    this.component.updateMinuteFromNumericInput(numString);
  }
}

export class MeridianFocusKeyboardHandler extends BaseKeyboardHandler {
  onArrowUp(): void {
    this.component.toggleMeridian();
  }
  onArrowDown(): void {
    this.component.toggleMeridian();
  }
  onArrowLeft(): void {
    this.component.keyboardFocus = 'minute';
  }
  onArrowRight(): void {
    // no-op
  }
  onNumberKey(ev: KeyboardEvent): void {
    this.component.keyboardFocus = 'hour';
    let numString = ev.code.replace('Digit', '');
    this.component.updateHourFromNumericInput(numString);
  }
}
