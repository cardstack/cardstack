import { action } from '@ember/object';
import { Participant, WorkflowPostable } from './workflow-postable';
import { IWorkflowSession } from './workflow-session';

export interface WorkflowCardComponentArgs {
  workflowSession: IWorkflowSession;
  onComplete: (() => void) | undefined;
  onIncomplete: (() => void) | undefined;
  isComplete: boolean;
}

type SuccessCheckResult = {
  success: true;
};

type FailureCheckResult = {
  success: false;
  reason: string;
};

export type CheckResult = SuccessCheckResult | FailureCheckResult;

interface WorkflowCardOptions<T extends string> {
  cardName?: string;
  author?: Participant;
  componentName: T; // this should eventually become a card reference
  includeIf?(this: WorkflowCard<T>): boolean;
  check?(this: WorkflowCard<T>): Promise<CheckResult>;
}

/**
 * This will create an object type with all keys in `Keys`,
 * which require a type equal to `Value`.
 *
 * The properties are optional if it is possible for Value to be undefined (eg. "a" | "b" | undefined)
 */
type ObjectInheritingValueOptionality<
  Keys extends string,
  Value
> = undefined extends Value
  ? { [key in Keys]?: Value }
  : { [key in Keys]: Value };

export class WorkflowCard<T extends string = string> extends WorkflowPostable {
  cardName: string;
  componentName: T;
  config?: any;
  check: (this: WorkflowCard<T>) => Promise<CheckResult> = () => {
    return Promise.resolve({ success: true });
  };

  /**
   * This constructor checks if the componentName is registered in the CardConfiguration interface, and if so, whether the componentName's
   * corresponding type in that interface is optional or not.
   *
   * If the componentName is not registered, this class is not allowed to be instantiated with a config property.
   * If the componentName is registered, then this class must either:
   *
   * 1. Be instantiated with a mandatory config property (If the componentName was not specified as optional)
   * 2. Be instantiated with an optional config property
   *
   * To add config to a card, you should add:
   *
   * ```
   * declare module '@cardstack/ssr-web/models/workflow/workflow-card' {
   *   interface CardConfiguration {
   *     '<what you would pass to the component helper>': {
   *       // ...whatever config you need
   *     };
   *   }
   * }
   * ```
   *
   * If you want config to be optional, just specify a ? in the definition of the property:
   * ```
   * declare module '@cardstack/ssr-web/models/workflow/workflow-card' {
   *   interface CardConfiguration {
   *     '<what you would pass to the component helper>'?: {
   *       // ...whatever config you need
   *     };
   *   }
   * }
   * ```
   */
  constructor(
    options: WorkflowCardOptions<
      T &
        (T extends keyof CardConfiguration
          ? // note that this string here is an exception to detection for being in the card configuration registry
            // so if you do 'card-pay/layer-one-connect-card' as the string, we won't be able to detect whether it's in the registry
            'You need config for this item'
          : {})
    >
  );
  constructor(
    options: T extends keyof CardConfiguration
      ? WorkflowCardOptions<T> &
          ObjectInheritingValueOptionality<'config', CardConfiguration[T]>
      : never
  );
  constructor(
    options: WorkflowCardOptions<T> & {
      config?: T extends keyof CardConfiguration ? CardConfiguration[T] : never;
    }
  ) {
    super(options.author, options.includeIf);
    this.componentName = options.componentName!;
    this.cardName = options.cardName || '';
    if (this.hasConfig(options)) this.config = options.config;

    this.reset = () => {
      if (this.isComplete) {
        this.isComplete = false;
      }
    };
    if (options.check) {
      this.check = options.check as this['check'];
    }
  }
  get session(): IWorkflowSession | undefined {
    return this.workflow?.session;
  }

  get completedCardNames(): Array<string> {
    return this.session?.getMeta()?.completedCardNames ?? [];
  }

  hasConfig(
    options: any
  ): options is { config: CardConfiguration[keyof CardConfiguration] } {
    return Object.keys(options).includes('config');
  }

  @action async onComplete() {
    if (this.isComplete) return;
    let checkResult = await this.check();
    if (checkResult.success) {
      // visible-postables-will-change starts test waiters in animated-workflow.ts
      this.workflow?.emit('visible-postables-will-change');
      this.isComplete = true;
    } else {
      this.workflow?.cancel(checkResult.reason);
    }

    if (this.isComplete && this.cardName) {
      if (!this.completedCardNames.includes(this.cardName)) {
        this.session?.setMeta({
          completedCardNames: [...this.completedCardNames, this.cardName],
          completedMilestonesCount: this.workflow?.completedMilestoneCount,
          milestonesCount: this.workflow?.milestones.length,
        });
      }
    }
  }

  @action onIncomplete() {
    this.workflow?.resetTo(this);

    if (this.cardName && this.completedCardNames.length > 0) {
      const resetToIndex = this.completedCardNames.indexOf(this.cardName);

      this.session?.setMeta({
        completedCardNames: this.completedCardNames.slice(0, resetToIndex),
        completedMilestonesCount: this.workflow?.completedMilestoneCount,
        milestonesCount: this.workflow?.milestones.length,
      });
    }
  }
}

export interface CardConfiguration {}
