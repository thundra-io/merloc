#!/usr/bin/env node
import { config, DotenvConfigOutput } from "dotenv";
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { BrokerStack } from '../lib/BrokerStack';

const result: DotenvConfigOutput = config({ path: `${__dirname}/../.env` });
if (result.error) {
    throw result.error;
}

const app = new cdk.App();
const props = {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION
    },
};

new BrokerStack(app, 'merloc-broker', props);
