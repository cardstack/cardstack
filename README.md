Work in progress
================

Notes
-----

Building nodegit's native dependencies on recent OSX is a giant pain. I am using Linux in Vagrant instead. Which makes it harder to debug using vscode (which is the best node debugger by far.

To debug, add `--debug=0.0.0.0:5858` to a node command within the VM, and use the "Attach to Process" launch target in vscode. There is a `debug-test` script in package.json that does this for the test suite.

`--debug-brk` doesn't seem to work due to V8 Proxy bugs, so you may need to manually insert `debugger` statements to get the program to wait for you. 


