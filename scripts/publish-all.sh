#!/bin/bash

for f in `find packages -name package.json -maxdepth 2`; do
    pushd `dirname $f`;
    npm publish --access=public;
    popd;
done
