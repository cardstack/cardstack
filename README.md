Work in progress
================

Orientation
---------------

This is a monorepo. Each directory under `packages` is intended to be distributed as a  functioning npm package under the `@cardstack` organization. For the present, in order for them to find each other you must create these symlinks:

    for p in `ls packages`; do ln -s ../../packages/$p node_modules/@cardstack/; done
    
The top-level package.json is a superset of everything needed by all the packages, so in development you should only need to yarn install at the top level.

Building native nodegit dep on osx
--------------------------------

You need the latest Xcode *and* you need to manually tell it to get the latest CLI tools via

    sudo xcode-select --install
    
Merely upgrading Xcode will still leave you broken and frustrated.

I cloned and built nodegit in its own repo, and then used `yarn link`. This seems to function as insurance against `yarn` deciding to rebuild it from scratch (which takes a long time).

Notes on vagrant & debugging
-----

I created a vagrant config that runs everything under Linux. This is nice for containing the dependencies like elasticsearch.

A downside of the Vagrant virtual machine is that it's not obvious how to debug using VSCode (which is the best node debugger by far, at the present).

To debug, add `--debug=0.0.0.0:5858` to a node command within the VM, and use the "Attach to Process" launch target in vscode. There is a `debug-test` script in package.json that does this for the test suite.

`--debug-brk` doesn't seem to work due to V8 Proxy bugs, so you may need to manually insert `debugger` statements to get the program to wait for you. 

You can also just use the VM as a container for elasticsearch. It's configured to expose the elasticsearch port directly to the host machine.
