import * as cdk from '@aws-cdk/core';
import { Duration } from '@aws-cdk/core';
import * as acm from '@aws-cdk/aws-certificatemanager';
import * as apigwv2 from '@aws-cdk/aws-apigatewayv2';
import { WebSocketLambdaAuthorizer } from '@aws-cdk/aws-apigatewayv2-authorizers';
import { WebSocketLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import { Effect, Policy, PolicyStatement } from '@aws-cdk/aws-iam';
import { Runtime } from '@aws-cdk/aws-lambda';
import { NodejsFunction } from '@aws-cdk/aws-lambda-nodejs';
import * as route53 from '@aws-cdk/aws-route53';
import * as route53Target from '@aws-cdk/aws-route53-targets';

const DEFAULT_DEBUG_ENABLE = 'true';
const DEFAULT_BROKER_CONNECTION_HANDLER_FUNCTION_MEMORY_SIZE: string = '1024';
const DEFAULT_BROKER_CONNECTION_HANDLER_FUNCTION_TIMEOUT: string = '30';
const DEFAULT_BROKER_MESSAGE_HANDLER_FUNCTION_MEMORY_SIZE: string = '1024';
const DEFAULT_BROKER_MESSAGE_HANDLER_FUNCTION_TIMEOUT: string = '30';
const DEFAULT_BROKER_WS_API_STAGE_NAME = 'dev';
const DEFAULT_BROKER_WS_API_SUBDOMAIN_NAME = 'merloc';

interface CoreStackProps extends cdk.NestedStackProps {
  brokerAuthorizerHandlerFunction: NodejsFunction
}

export class CoreStack extends cdk.NestedStack {

  private readonly clientConnectionsTable: dynamodb.Table;
  private readonly gatekeeperConnectionsTable: dynamodb.Table;
  private readonly clientGatekeeperConnectionPairsTable: dynamodb.Table;
  private readonly brokerConnectionHandlerFunction: NodejsFunction;
  private readonly brokerMessageHandlerFunction: NodejsFunction;
  private readonly brokerAuthorizerHandlerFunction: NodejsFunction;
  private readonly brokerWebSocketAPICertificate: acm.DnsValidatedCertificate;
  private readonly brokerWebSocketAPIDomainName: apigwv2.DomainName;
  private readonly brokerWebSocketAPIDNSRecord: route53.ARecord;
  private readonly brokerWebSocketAPI: apigwv2.WebSocketApi;
  private readonly brokerWebSocketAPIStage: apigwv2.WebSocketStage;

  constructor(scope: cdk.Construct, id: string, props: CoreStackProps) {
    super(scope, id, props);

    this.brokerAuthorizerHandlerFunction = props.brokerAuthorizerHandlerFunction;

    // Create client connections table
    this.clientConnectionsTable = new dynamodb.Table(this, `merloc-client-connections-${process.env.STAGE}`, {
      tableName: `merloc-client-connections-${process.env.STAGE}`,
      partitionKey: {
        name: 'name',
        type: dynamodb.AttributeType.STRING,
      },
      timeToLiveAttribute: 'expireTimestamp',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    new cdk.CfnOutput(this, `merloc-client-connections-table-name-output-${process.env.STAGE}`, {
      value: this.clientConnectionsTable.tableName,
      exportName: `merloc-client-connections-table-name-${process.env.STAGE}`,
    });
    new cdk.CfnOutput(this, `merloc-client-connections-table-arn-output-${process.env.STAGE}`, {
      value: this.clientConnectionsTable.tableArn,
      exportName: `merloc-client-connections-table-arn-${process.env.STAGE}`,
    });

    // Create gatekeeper connections table
    this.gatekeeperConnectionsTable = new dynamodb.Table(this, `merloc-gatekeeper-connections-${process.env.STAGE}`, {
      tableName: `merloc-gatekeeper-connections-${process.env.STAGE}`,
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      timeToLiveAttribute: 'expireTimestamp',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    new cdk.CfnOutput(this, `merloc-gatekeeper-connections-table-name-output-${process.env.STAGE}`, {
      value: this.gatekeeperConnectionsTable.tableName,
      exportName: `merloc-gatekeeper-connections-table-name-${process.env.STAGE}`,
    });
    new cdk.CfnOutput(this, `merloc-gatekeeper-connections-table-arn-output-${process.env.STAGE}`, {
      value: this.gatekeeperConnectionsTable.tableArn,
      exportName: `merloc-gatekeeper-connections-table-arn-${process.env.STAGE}`,
    });

    // Create client-gatekeeper connection pairs table
    this.clientGatekeeperConnectionPairsTable = new dynamodb.Table(this, `merloc-client-gatekeeper-connection-pairs-${process.env.STAGE}`, {
      tableName: `merloc-client-gatekeeper-connection-pairs-${process.env.STAGE}`,
      partitionKey: {
        name: 'clientConnectionId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'gatekeeperConnectionId',
        type: dynamodb.AttributeType.STRING,
      },
      timeToLiveAttribute: 'expireTimestamp',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    new cdk.CfnOutput(this, `merloc-client-gatekeeper-connection-pairs-table-name-output-${process.env.STAGE}`, {
      value: this.clientGatekeeperConnectionPairsTable.tableName,
      exportName: `merloc-client-gatekeeper-connection-pairs-table-name-${process.env.STAGE}`,
    });
    new cdk.CfnOutput(this, `merloc-client-gatekeeper-connection-pairs-table-arn-output-${process.env.STAGE}`, {
      value: this.clientGatekeeperConnectionPairsTable.tableArn,
      exportName: `merloc-client-gatekeeper-connection-pairs-table-arn-${process.env.STAGE}`,
    });

    // Create broker connection handler function
    this.brokerConnectionHandlerFunction = new NodejsFunction(this, `merloc-broker-connection-handler-${process.env.STAGE}`, {
      entry: `${__dirname}/../../../src/lambdas/ConnectionHandler.ts`,
      depsLockFilePath: `${__dirname}/../../../src/package-lock.json`,
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
      functionName: `merloc-broker-connection-handler-${process.env.STAGE}`,
      handler: 'handler',
      runtime: Runtime.NODEJS_16_X,
      timeout: Duration.seconds(parseInt(
        process.env.MERLOC_BROKER_CONNECTION_HANDLER_FUNCTION_TIMEOUT
          || DEFAULT_BROKER_CONNECTION_HANDLER_FUNCTION_TIMEOUT)),
      memorySize: parseInt(
        process.env.MERLOC_BROKER_CONNECTION_HANDLER_FUNCTION_MEMORY_SIZE
          || DEFAULT_BROKER_CONNECTION_HANDLER_FUNCTION_MEMORY_SIZE),
      environment: {
        MERLOC_DEBUG_ENABLE: process.env.MERLOC_DEBUG_ENABLE || DEFAULT_DEBUG_ENABLE,
        MERLOC_CLIENT_CONNECTIONS_TABLE_NAME: this.clientConnectionsTable.tableName,
        MERLOC_GATEKEEPER_CONNECTIONS_TABLE_NAME: this.gatekeeperConnectionsTable.tableName,
        MERLOC_CLIENT_GATEKEEPER_CONNECTION_PAIRS_TABLE_NAME: this.clientGatekeeperConnectionPairsTable.tableName,
      },
    });

    // Give access to broker connection handler function for client and gatekeeper connections and pairs tables
    this.clientConnectionsTable.grantReadWriteData(this.brokerConnectionHandlerFunction);
    this.gatekeeperConnectionsTable.grantReadWriteData(this.brokerConnectionHandlerFunction);
    this.clientGatekeeperConnectionPairsTable.grantReadWriteData(this.brokerConnectionHandlerFunction);

    // Create broker message handler function
    this.brokerMessageHandlerFunction = new NodejsFunction(this, `merloc-broker-message-handler-${process.env.STAGE}`, {
      entry: `${__dirname}/../../../src/lambdas/MessageHandler.ts`,
      depsLockFilePath: `${__dirname}/../../../src/package-lock.json`,
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
      functionName: `merloc-broker-message-handler-${process.env.STAGE}`,
      handler: 'handler',
      runtime: Runtime.NODEJS_16_X,
      timeout: Duration.seconds(parseInt(
        process.env.MERLOC_BROKER_MESSAGE_HANDLER_FUNCTION_TIMEOUT
          || DEFAULT_BROKER_MESSAGE_HANDLER_FUNCTION_TIMEOUT)),
      memorySize: parseInt(
        process.env.MERLOC_BROKER_MESSAGE_HANDLER_FUNCTION_MEMORY_SIZE
          || DEFAULT_BROKER_MESSAGE_HANDLER_FUNCTION_MEMORY_SIZE),
      environment: {
        MERLOC_DEBUG_ENABLE: process.env.MERLOC_DEBUG_ENABLE || DEFAULT_DEBUG_ENABLE,
        MERLOC_CLIENT_CONNECTIONS_TABLE_NAME: this.clientConnectionsTable.tableName,
        MERLOC_GATEKEEPER_CONNECTIONS_TABLE_NAME: this.gatekeeperConnectionsTable.tableName,
        MERLOC_CLIENT_GATEKEEPER_CONNECTION_PAIRS_TABLE_NAME: this.clientGatekeeperConnectionPairsTable.tableName,
      },
    });

    // Give access to broker message handler function for client and gatekeeper connections and pairs table
    this.clientConnectionsTable.grantReadWriteData(this.brokerMessageHandlerFunction);
    this.gatekeeperConnectionsTable.grantReadWriteData(this.brokerMessageHandlerFunction);
    this.clientGatekeeperConnectionPairsTable.grantReadWriteData(this.brokerMessageHandlerFunction);

    // Create broker websocket API
    this.brokerWebSocketAPI = new apigwv2.WebSocketApi(this, `merloc-broker-ws-api-${process.env.STAGE}`, {
      apiName: `merloc-broker-ws-api-${process.env.STAGE}`,
      connectRouteOptions: {
        integration: new WebSocketLambdaIntegration('connectionIntegration', this.brokerConnectionHandlerFunction),
        authorizer: new WebSocketLambdaAuthorizer('connectionAuthorizer', this.brokerAuthorizerHandlerFunction, {
          identitySource: [
            'route.request.header.x-api-key'
          ]
        })
      },
      disconnectRouteOptions: {
        integration: new WebSocketLambdaIntegration('disconnectIntegration', this.brokerConnectionHandlerFunction),
      },
      defaultRouteOptions: {
        integration: new WebSocketLambdaIntegration('defaultIntegration', this.brokerMessageHandlerFunction),
      },
      routeSelectionExpression: '$request.body.type',
    });
    new cdk.CfnOutput(this, `merloc-broker-ws-api-name-output-${process.env.STAGE}`, {
      value: this.brokerWebSocketAPI.webSocketApiName || '',
      exportName: `merloc-broker-ws-api-name-${process.env.STAGE}`,
    });
    new cdk.CfnOutput(this, `merloc-broker-ws-api-id-output-${process.env.STAGE}`, {
      value: this.brokerWebSocketAPI.apiId,
      exportName: `merloc-broker-ws-api-id-${process.env.STAGE}`,
    });
    new cdk.CfnOutput(this, `merloc-broker-ws-api-endpoint-output-${process.env.STAGE}`, {
      value: this.brokerWebSocketAPI.apiEndpoint,
      exportName: `merloc-broker-ws-api-endpoint-${process.env.STAGE}`,
    });

    // Check whether custom domain name is specified
    if (process.env.MERLOC_DOMAIN_NAME) {
      const brokerWebSocketAPISubDomainName: string =
        process.env.MERLOC_BROKER_WS_API_SUBDOMAIN_NAME || DEFAULT_BROKER_WS_API_SUBDOMAIN_NAME;
      const brokerWebSocketAPIFullDomainName: string =
        `${brokerWebSocketAPISubDomainName}.${process.env.MERLOC_DOMAIN_NAME}`;

      const zone: route53.IHostedZone = route53.HostedZone.fromLookup(this, `merloc-zone-${process.env.STAGE}`, {
        domainName: `${process.env.MERLOC_DOMAIN_NAME}`
      });

      // Create broker websocket API certificate
      this.brokerWebSocketAPICertificate = new acm.DnsValidatedCertificate(this, `merloc-broker-ws-api-certificate-${process.env.STAGE}`, {
        domainName: `${brokerWebSocketAPIFullDomainName}`,
        subjectAlternativeNames: [`*.${brokerWebSocketAPIFullDomainName}`],
        hostedZone: zone,
      });
      new cdk.CfnOutput(this, `merloc-broker-ws-api-certificate-arn-output-${process.env.STAGE}`, {
        value: this.brokerWebSocketAPICertificate.certificateArn,
        exportName: `merloc-broker-ws-api-certificate-arn-${process.env.STAGE}`,
      });

      // Create broker websocket API custom domain name
      this.brokerWebSocketAPIDomainName = new apigwv2.DomainName(this, `merloc-broker-ws-api-domain-name-${process.env.STAGE}`, {
        domainName: brokerWebSocketAPIFullDomainName,
        certificate: this.brokerWebSocketAPICertificate,
      });
      new cdk.CfnOutput(this, `merloc-broker-ws-api-domain-name-output-${process.env.STAGE}`, {
        value: this.brokerWebSocketAPIDomainName.name,
        exportName: `merloc-broker-ws-api-domain-name-${process.env.STAGE}`,
      });

      // Create DNS record which points to broker websocket API custom domain name
      this.brokerWebSocketAPIDNSRecord = new route53.ARecord(this, `merloc-broker-ws-api-dns-record-${process.env.STAGE}`, {
        zone: zone,
        recordName: brokerWebSocketAPISubDomainName,
        target: route53.RecordTarget.fromAlias(
          new route53Target.ApiGatewayv2DomainProperties(
            this.brokerWebSocketAPIDomainName.regionalDomainName,
            this.brokerWebSocketAPIDomainName.regionalHostedZoneId)),
      });
    }

    // Create broker websocket API stage
    this.brokerWebSocketAPIStage = new apigwv2.WebSocketStage(this, `merloc-broker-ws-api-stage-${process.env.STAGE}`, {
      webSocketApi: this.brokerWebSocketAPI,
      stageName: process.env.STAGE || DEFAULT_BROKER_WS_API_STAGE_NAME,
      autoDeploy: true,
      domainMapping:
        this.brokerWebSocketAPIDomainName
          ? {
            domainName: this.brokerWebSocketAPIDomainName,
          }
          : undefined,
    });
    new cdk.CfnOutput(this, `merloc-broker-ws-api-stage-name-output-${process.env.STAGE}`, {
      value: this.brokerWebSocketAPIStage.stageName,
      exportName: `merloc-broker-ws-api-stage-name-${process.env.STAGE}`,
    });
    new cdk.CfnOutput(this, `merloc-broker-ws-api-stage-url-output-${process.env.STAGE}`, {
      value: this.brokerWebSocketAPIStage.url,
      exportName: `merloc-broker-ws-api-stage-url-${process.env.STAGE}`,
    });
    new cdk.CfnOutput(this, `merloc-broker-ws-api-stage-callback-url-output-${process.env.STAGE}`, {
      value: this.brokerWebSocketAPIStage.callbackUrl,
      exportName: `merloc-broker-ws-api-stage-callback-url-${process.env.STAGE}`,
    });

    // Create policy to allow Lambda function to use @connections API of API Gateway
    const allowConnectionManagementOnApiGatewayPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      resources: [
        `arn:aws:execute-api:${this.region}:${this.account}:${this.brokerWebSocketAPI.apiId}/${this.brokerWebSocketAPIStage.stageName}/*`,
      ],
      actions: [
        'execute-api:ManageConnections',
        'execute-api:Invoke',
      ],
    });

    // Give access to broker connection and message handler functions for broker API management
    this.brokerConnectionHandlerFunction.addToRolePolicy(allowConnectionManagementOnApiGatewayPolicy);
    this.brokerMessageHandlerFunction.addToRolePolicy(allowConnectionManagementOnApiGatewayPolicy);

    // To workaround the circular dependency
    this.brokerAuthorizerHandlerFunction.role!.attachInlinePolicy(
      new Policy(this, `broker-authorizer-handler-policy-${process.env.STAGE}`, {
        statements: [
          allowConnectionManagementOnApiGatewayPolicy
        ]
      })
    );
  }

  brokerURL(): string {
    return this.brokerWebSocketAPIStage.url;
  }
}
