#!/bin/bash

for f in `find packages -name package.json`; do
    pushd `dirname $f`;
    npm publish --access=public;
    popd;
done
