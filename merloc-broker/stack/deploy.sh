#!/bin/bash -ex
set -x
set -e

source ${PROFILE}/.env

if [ -z $STAGE ]
then
  echo "[ERROR] No 'STAGE' configuration could be found in the '${PROFILE}/.env' file"
  exit 1
fi

pushd app/

npm install
cdk bootstrap --no-color
cdk deploy merloc-broker-stack-${STAGE} --require-approval never --no-color

popd
