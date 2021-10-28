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

export interface WorkflowCardOptions {
  cardName?: string;
  author?: Participant;
  componentName: string; // this should eventually become a card reference
  includeIf?(this: WorkflowCard<WorkflowCardOptions>): boolean;
  check?(this: WorkflowCard<WorkflowCardOptions>): Promise<CheckResult>;
}

export interface ConfigurableWorkflowCardOptions extends WorkflowCardOptions {
  componentName: keyof CardConfiguration; // this should eventually become a card reference
  includeIf?(this: WorkflowCard<ConfigurableWorkflowCardOptions>): boolean;
  check?(
    this: WorkflowCard<ConfigurableWorkflowCardOptions>
  ): Promise<CheckResult>;
}

export class WorkflowCard<
  T extends
    | ConfigurableWorkflowCardOptions
    | WorkflowCardOptions = WorkflowCardOptions
> extends WorkflowPostable {
  cardName: string;
  componentName: string;
  config?: any;
  check: (this: WorkflowCard<T>) => Promise<CheckResult> = () => {
    return Promise.resolve({ success: true });
  };

  /**
   * ConfigurableWorkflowCardOptions is a set of options with componentName registered in the CardConfiguration interface
   * WorkflowCardOptions is a set of options without the componentName registered in the CardConfiguration interface
   *
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
   * declare module '@cardstack/web-client/models/workflow/workflow-card' {
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
   * declare module '@cardstack/web-client/models/workflow/workflow-card' {
   *   interface CardConfiguration {
   *     '<what you would pass to the component helper>'?: {
   *       // ...whatever config you need
   *     };
   *   }
   * }
   * ```
   */
  constructor(
    options: T extends ConfigurableWorkflowCardOptions
      ? T &
          (undefined extends CardConfiguration[T['componentName']]
            ? {
                config?: CardConfiguration[T['componentName']];
              }
            : { config: CardConfiguration[T['componentName']] })
      : never | WorkflowCardOptions
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
