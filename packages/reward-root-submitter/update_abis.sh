#!/bin/bash

set -eux


pushd $1

git checkout main
git pull

yarn build

popd

shopt -s extglob;

cp $1/artifacts/!(build-info)/**/*[!dbg].json abis/

shopt -u extglob;
