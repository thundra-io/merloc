#!/usr/bin/env node
import { config, DotenvConfigOutput } from "dotenv";
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { BrokerStack } from '../lib/BrokerStack';
import { Stack } from "@aws-cdk/core";
import { AuthorizerStack } from "../lib/AuthorizerStack";

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

const mainStack = new Stack(app, 'merloc-broker-stack', props);

const authorizerStack = new AuthorizerStack(mainStack, 'merloc-broker-authorizer');
const brokerStack = new BrokerStack(mainStack, 'merloc-broker-websocket', {
    brokerAuthorizerHandlerFunction: authorizerStack.brokerAuthorizerHandlerFunction
});
