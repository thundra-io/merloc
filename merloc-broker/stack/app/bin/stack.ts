#!/usr/bin/env node
import { config, DotenvConfigOutput } from "dotenv";
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CoreStack } from '../lib/CoreStack';
import { Stack } from "@aws-cdk/core";
import { AuthorizerStack } from "../lib/AuthorizerStack";

const result: DotenvConfigOutput = config({ path: `${__dirname}/../../deployment/${process.env.PROFILE}/.env` });
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

const mainStack = new Stack(app, `merloc-broker-stack-${process.env.STAGE}`, props);

const authorizerStack = new AuthorizerStack(mainStack, `merloc-broker-authorizer-${process.env.STAGE}`);

const coreStack = new CoreStack(mainStack, `merloc-broker-core-${process.env.STAGE}`, {
    brokerAuthorizerHandlerFunction: authorizerStack.brokerAuthorizerHandlerFunction
});
coreStack.addDependency(
    authorizerStack,
    'Uses the AuthorizerHandler Function'
);

new cdk.CfnOutput(mainStack, `merloc-broker-url-output-${process.env.STAGE}`, {
    value: coreStack.brokerURL(),
    exportName: `merloc-broker-url-${process.env.STAGE}`,
});
