Work in progress
================

Orientation
---------------

This is a monorepo. Each directory under `packages` is intended to be distributed as a  functioning npm package under the `@cardstack` organization. 

In development, we use `lerna` to manage their inter-dependencies. To get started:

 1. Install node >= 7.
 2. Install yarn >= 0.28 (earlier versions work but will not benefit from [Workspaces](https://yarnpkg.com/blog/2017/08/02/introducing-workspaces/).
 3. `yarn global add lerna` (use >= 2.0.0 for yarn workspaces integration)
 4. `lerna bootstrap` 


Building native nodegit dep on osx
--------------------------------

You need the latest Xcode *and* you need to manually tell it to get the latest CLI tools via

    sudo xcode-select --install
    
Merely upgrading Xcode will still leave you broken and frustrated.

I cloned and built nodegit in its own repo, and then used `yarn link`. This seems to function as insurance against `yarn` deciding to rebuild it from scratch (which takes a long time).

