export type ActionChinState =
  // state before the cta has been activated/the action done
  | 'default'
  // disabled state - currently visually corresponds to the default state.
  // design has no immediate plans to make a disabled state for the memorialized cta
  | 'disabled'
  // in progress state - action has been taken, but not completed
  | 'in-progress'
  // memorialized state - requirement for CTA has been met
  | 'memorialized';
