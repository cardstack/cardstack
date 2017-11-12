#!/bin/bash

pushd ..
find . \( -name package.json -o -name yarn.lock -o -name lerna.json \) -maxdepth 3 -print0 | tar -cf docker/stage1.tar --null -T -
find . \( -path "./packages/*/node_modules" -o -path "./node_modules" -o -name dist -o -name .git -o -path "./docker"  \) -prune -o \( -type f -o -type l \)  -print0 | tar -cf docker/stage2.tar --null -T -
popd
docker build . -t framework-wip
