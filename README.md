Work in progress
================

Orientation
---------------

This is a monorepo. Each directory under `packages` is intended to be distributed as a  functioning npm package under the `@cardstack` organization. 

In development, we use `lerna` to manage their inter-dependencies. To get started:

 1. Install node >= 7.
 2. Install yarn.
 3. `yarn global add lerna`
 4. `lerna bootstrap` 

You may be tempted to use `lerna bootstrap --hoist` to get a faster install. But this unfortunately causes lerna to ignore your yarn.lock files, and ember-cli doesn't like the resulting hoisted dependencies.

Building native nodegit dep on osx
--------------------------------

You need the latest Xcode *and* you need to manually tell it to get the latest CLI tools via

    sudo xcode-select --install
    
Merely upgrading Xcode will still leave you broken and frustrated.

I cloned and built nodegit in its own repo, and then used `yarn link`. This seems to function as insurance against `yarn` deciding to rebuild it from scratch (which takes a long time).

