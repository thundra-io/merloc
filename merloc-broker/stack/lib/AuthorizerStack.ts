import * as cdk from '@aws-cdk/core';
import { Duration } from '@aws-cdk/core';
import { Runtime } from '@aws-cdk/aws-lambda';
import { NodejsFunction } from '@aws-cdk/aws-lambda-nodejs';

const DEFAULT_DEBUG_ENABLE = 'true';
const DEFAULT_BROKER_AUTHORIZER_HANDLER_FUNCTION_MEMORY_SIZE: string = '1024';
const DEFAULT_BROKER_AUTHORIZER_HANDLER_FUNCTION_TIMEOUT: string = '30';
const DEFAULT_API_KEY_CHECK_ENABLE = 'false';

export class AuthorizerStack extends cdk.NestedStack {

  brokerAuthorizerHandlerFunction: NodejsFunction;

  constructor(scope: cdk.Construct, id: string, props?: cdk.NestedStackProps) {
    super(scope, id, props);

    this.brokerAuthorizerHandlerFunction = new NodejsFunction(this, 'merloc-broker-authorizer-handler', {
      entry: `${__dirname}/../../src/lambdas/AuthorizerHandler.ts`,
      depsLockFilePath: `${__dirname}/../../src/package-lock.json`,
      bundling: {
        commandHooks: {
          beforeBundling(inputDir: string, outputDir: string) {
            return [
              `cd ${inputDir}`,
              'npm install',
            ]
          },
          beforeInstall() {
            return []
          },
          afterBundling() {
            return []
          }
        }
      },
      functionName: 'merloc-broker-authorizer-handler',
      handler: 'handler',
      runtime: Runtime.NODEJS_16_X,
      timeout: Duration.seconds(parseInt(
        process.env.MERLOC_BROKER_AUTHORIZATION_HANDLER_FUNCTION_TIMEOUT
          || DEFAULT_BROKER_AUTHORIZER_HANDLER_FUNCTION_TIMEOUT)),
      memorySize: parseInt(
        process.env.MERLOC_BROKER_AUTHORIZATION_HANDLER_FUNCTION_MEMORY_SIZE
          || DEFAULT_BROKER_AUTHORIZER_HANDLER_FUNCTION_MEMORY_SIZE),
      environment: {
        MERLOC_DEBUG_ENABLE: process.env.MERLOC_DEBUG_ENABLE || DEFAULT_DEBUG_ENABLE,
        MERLOC_BROKER_AUTHORIZER_API_KEY_CHECK_ENABLE:
            process.env.MERLOC_BROKER_AUTHORIZER_API_KEY_CHECK_ENABLE || DEFAULT_API_KEY_CHECK_ENABLE,
      }
    });
  }
}
