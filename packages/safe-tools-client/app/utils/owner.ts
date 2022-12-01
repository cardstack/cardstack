import { getOwner } from '@ember/application';
import { assert } from '@ember/debug';
import { Registry } from '@ember/service';

// This file augments Ember's `Owner.lookup` so that it understands services in
// the same way that service injection does.

// This reexport is here because you cannot augment the type of a default
// export, but you can augment the type of a named export. So we reexport the
// type we want to augment to make it augmentable.
//
// https://github.com/Microsoft/TypeScript/issues/14080
export type { default as Owner } from '@ember/owner';

// This is *weird*. We are augmenting "our own module" here, and since we
// reexport the underlying type from Ember we are therefore augmenting that
// type.
declare module './owner' {
  interface Owner {
    lookup<Name extends keyof Registry>(
      fullName: `service:${Name}`
    ): Registry[Name];
  }
}

export function strongGetOwner(obj: unknown): Owner {
  const result = getOwner(obj);
  assert('owner is present', !!result);
  return result;
}
