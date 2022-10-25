#!/bin/bash

set -eux


pushd $1

git checkout main
git pull

yarn build

popd

shopt -s extglob;

cp $1/artifacts/!(build-info)/**/*[!dbg].json packages/cardpay-reward-scheduler/abis/
cp $1/artifacts/!(build-info)/**/*[!dbg].json packages/reward-root-submitter/abis/
cp $1/artifacts/!(build-info)/**/*[!dbg].json packages/cardpay-reward-api/abis/

shopt -u extglob;
