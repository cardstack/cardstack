import * as syntax from '@glimmer/syntax';
import type { Node } from '@glimmer/syntax/dist/types/lib/v1/api';

interface Unset {
  unset: true;
}

type Binding<Value> =
  | { type: 'normal' }
  | { type: 'assigned'; value: Value | Unset; overrides: Map<syntax.ASTv1.Statement, Value> };

type Scope<Value> = Map<string, Binding<Value>>;

export class ScopeTracker<Value> {
  private scopes: Scope<Value>[] = [new Map()];
  nextScope: Scope<Value> | undefined;

  blockStatementEnter(node: syntax.ASTv1.BlockStatement) {
    this.nextScope = new Map();
    for (let name of node.program.blockParams) {
      this.nextScope.set(name, { type: 'normal' });
    }
  }

  blockEnter() {
    if (!this.nextScope) {
      throw new Error(`bug: all blocks should introduce a scope`);
    }
    this.scopes.unshift(this.nextScope);
    this.nextScope = undefined;
  }

  blockExit() {
    this.scopes.shift();
  }

  // remembers the given value for the given identifier in the current scope
  assign(
    // the name you're defining
    identifier: string,
    // your value that you will want to get back later from lookup()
    value: Value,
    opts?: {
      // when provided, your assignment only applies inside the given statement,
      // not the whole current scope
      inside?: syntax.ASTv1.Statement;

      // when provided, your assignment applies to the nextScope, not the
      // current scope. NextScope exists after blockStatementEnter but before
      // blockEnter.
      onNextScope?: boolean;
    }
  ): void {
    let target = this.targetScope(opts?.onNextScope);
    let binding = target.get(identifier);
    if (!binding || binding.type === 'normal') {
      if (opts?.inside) {
        target.set(identifier, {
          type: 'assigned',
          value: { unset: true },
          overrides: new Map([[opts.inside, value]]),
        });
      } else {
        target.set(identifier, {
          type: 'assigned',
          value,
          overrides: new Map(),
        });
      }
    } else {
      if (opts?.inside) {
        binding.overrides.set(opts.inside, value);
      } else {
        binding.value = value;
      }
    }
  }

  private targetScope(onNextScope: undefined | boolean): Scope<Value> {
    if (onNextScope) {
      let { nextScope } = this;
      if (!nextScope) {
        throw new Error(
          `tried to use onNextScope, but that only works after blockStatementEnter and before blockEnter`
        );
      }
      return nextScope;
    } else {
      return this.scopes[0];
    }
  }

  lookup(identifier: string, path: syntax.WalkerPath<Node>): { type: 'assigned'; value: Value } | { type: 'normal' } {
    for (let scope of this.scopes) {
      let binding = scope.get(identifier);
      if (!binding) {
        continue;
      }
      if (binding.type === 'normal') {
        return binding;
      }

      let matchedOverride = enclosingScopeValue(path, binding.overrides);
      if (matchedOverride) {
        return matchedOverride;
      }

      if ('unset' in binding.value) {
        continue;
      }
      return { type: 'assigned', value: binding.value };
    }
    return { type: 'normal' };
  }
}

function enclosingScopeValue<Value>(
  path: syntax.WalkerPath<Node>,
  nodes: Map<unknown, Value>
): { type: 'assigned'; value: Value } | undefined {
  let cursor: syntax.WalkerPath<Node> | null = path;
  while (cursor) {
    if (nodes.has(cursor.node)) {
      return { type: 'assigned', value: nodes.get(cursor.node)! };
    }
    cursor = cursor.parent;
  }
  return undefined;
}
