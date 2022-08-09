#!/bin/bash -ex
set -x
set -e

npm install
cdk bootstrap --no-color
cdk deploy merloc-broker --require-approval never --no-color
