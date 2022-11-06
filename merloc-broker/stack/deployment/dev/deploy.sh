#!/bin/bash -ex
set -x
set -e

export PROFILE=dev

pushd ../

./deploy.sh

popd
