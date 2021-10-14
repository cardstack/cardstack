# Compiled

This package is dynamically populated with cards when the `hub` compiles cards. Having it as a seperate package allows for webpack to it's tree-shaking magic.

## FAQ

### Missing dependency errors

Since cards are not yet individual packages themselves, the package.json of `compiled` is required to list out the dependencies of all the cards that may be compiled by the server. Again, this is so webpack treeshaking can work.
