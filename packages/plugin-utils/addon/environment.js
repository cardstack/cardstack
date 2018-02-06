// This file only gets included in the app if no hub is running.  If a
// hub is running, we instead rely on it's code-generators support to
// generate this file (and populate it with more meaningful, dynamic
// data).
//
// The default values here are useful for situations like within
// plugin's own test suites.
//
// If you find yourself wanting to customize the values in this file,
// you should really just configure the hub and add some seed models
// so it runs.
export const defaultBrach = 'master';
export const hubURL = 'http://localhost:3000';
export const compiledAt = null;
export const appModulePrefix = 'dummy';
export const branch = 'master';
