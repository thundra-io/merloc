import { APIGatewayEvent } from 'aws-lambda';
import {
    DynamoDBClient,
    PutItemCommand,
    PutItemCommandInput,
    PutItemCommandOutput,
    DeleteItemCommand,
    DeleteItemCommandInput,
    DeleteItemCommandOutput,
    QueryCommand,
    QueryCommandInput,
    QueryCommandOutput,
} from '@aws-sdk/client-dynamodb';
import {
    debug,
    error,
} from './Logger';
import {
    CONNECT_EVENT_TYPE,
    DISCONNECT_EVENT_TYPE,
    CONNECTION_NAME_HEADER_NAME,
    CLIENT_CONNECTION_TYPE,
    GATEKEEPER_CONNECTION_TYPE,
    CLIENT_DISCONNECT_MESSAGE_TYPE,
    CLIENT_CONNECTION_OVERRIDE_MESSAGE_TYPE,
    CLIENT_CONNECTION_EXPIRE_TIME_IN_SECONDS,
    GATEKEEPER_CONNECTION_EXPIRE_TIME_IN_SECONDS,
    getCurrentTimeInSeconds,
    generateLambdaProxyResponse,
    postToConnection,
    buildBrokerEnvelope,
    isClientConnection,
    isGateKeeperConnection,
    getClientConnectionName,
    getGateKeeperConnectionName,
} from './Utils';
import { BrokerEnvelope } from './BrokerEnvelope';

const dynamodbClient = new DynamoDBClient({ });

async function handleClientConnect(event: APIGatewayEvent,
                                   connectionName: string, connectionId: string): Promise<any> {
    debug(`Client connected (name=${connectionName}, id=${connectionId}`);

    const currentTimeInSeconds: number = getCurrentTimeInSeconds();
    const expireTimestamp: number = currentTimeInSeconds + CLIENT_CONNECTION_EXPIRE_TIME_IN_SECONDS;

    const input: PutItemCommandInput = {
        TableName: process.env.MERLOC_CLIENT_CONNECTIONS_TABLE_NAME,
        Item: {
            'name': {S: connectionName},
            'id': {S: connectionId},
            'savedAt': {N: currentTimeInSeconds.toString()},
            'expireTimestamp': {N: expireTimestamp.toString()},
        },
        ReturnValues: 'ALL_OLD',
    };
    const command: PutItemCommand = new PutItemCommand(input);

    try {
        const output: PutItemCommandOutput = await dynamodbClient.send(command);
        if (output && output.Attributes && output.Attributes.id && output.Attributes.id.S) {
            const oldConnectionId: string = output.Attributes.id.S;
            debug(`New client connection (name=${connectionName}, id=${connectionId}) ` +
                  `has overridden old connection (id=${oldConnectionId})`);
            const brokerEnvelope: BrokerEnvelope =
                buildBrokerEnvelope(
                    CLIENT_CONNECTION_OVERRIDE_MESSAGE_TYPE,
                    connectionName, oldConnectionId, undefined, CLIENT_CONNECTION_TYPE);
            await postToConnection(event, brokerEnvelope, oldConnectionId);
        }
        return generateLambdaProxyResponse(200, 'Connected');
    } catch (e) {
        error(`Unable to save client connection`, e);
        return generateLambdaProxyResponse(500, 'Connect failed');
    }
}

async function notifyPairedGateKeeperConnectionsOnClientDisconnect(
    event: APIGatewayEvent, connectionName: string, clientConnectionId: string): Promise<any> {

    const input: QueryCommandInput = {
        TableName: process.env.MERLOC_CLIENT_GATEKEEPER_CONNECTION_PAIRS_TABLE_NAME,
        KeyConditions: {
            'clientConnectionId': {
                AttributeValueList: [{S: clientConnectionId}],
                ComparisonOperator: 'EQ',
            },
        },
    };

    const command: QueryCommand = new QueryCommand(input);
    try {
        const output: QueryCommandOutput = await dynamodbClient.send(command);
        if (output.Items) {
            for (let item of output.Items) {
                if (item.gatekeeperConnectionId && item.gatekeeperConnectionId.S) {
                    const gatekeeperConnectionId: string = item.gatekeeperConnectionId.S;
                    const brokerEnvelope: BrokerEnvelope =
                        buildBrokerEnvelope(
                            CLIENT_DISCONNECT_MESSAGE_TYPE,
                            connectionName, gatekeeperConnectionId, undefined, GATEKEEPER_CONNECTION_TYPE);
                    try {
                        await postToConnection(event, brokerEnvelope, gatekeeperConnectionId);
                        debug(`Notified paired gatekeeper connection (id=${clientConnectionId})` +
                              `about disconnected client connection (name=${connectionName}, id=${clientConnectionId})`);
                    } catch (e) {
                        error(`Couldn't notify paired gatekeeper connection (id=${clientConnectionId})` +
                              `about disconnected client connection (name=${connectionName}, id=${clientConnectionId})`,
                              e);
                    }
                }
            }
            // TODO Should we remove client-gatekeeper connection pairs
            // I think, we should not because once a client disconnected,
            // client-gatekeeper connection pairs will not be accessible anymore.
            // And since each client-gatekeeper connection pair item has expire timestamp,
            // they will be removed eventually by AWS DynamoDB.
        }
    } catch (e) {
        error(`Couldn't notify paired gatekeeper connections` +
              `about disconnected client connection (name=${connectionName}, id=${clientConnectionId})`,
              e);
    }
}

async function handleClientDisconnect(event: APIGatewayEvent,
                                      connectionName: string, connectionId: string): Promise<any> {
    debug(`Client disconnected (name=${connectionName}, id=${connectionId}`);

    const input: DeleteItemCommandInput = {
        TableName: process.env.MERLOC_CLIENT_CONNECTIONS_TABLE_NAME,
        Key: {
            'name': {S: connectionName},
        },
        Expected: {
            'id': {
                Value: {S: connectionId},
                ComparisonOperator: 'EQ',
            }
        },
    };
    const command: DeleteItemCommand = new DeleteItemCommand(input);

    let response;
    try {
        await dynamodbClient.send(command);
        response = generateLambdaProxyResponse(200, 'Disconnected');
    } catch (e) {
        error(`Unable to remove client connection`, e);
        response = generateLambdaProxyResponse(500, 'Disconnect failed');
    }

    await notifyPairedGateKeeperConnectionsOnClientDisconnect(event, connectionName, connectionId);

    return response;
}

async function handleGateKeeperConnect(event: APIGatewayEvent,
                                       connectionName: string, connectionId: string): Promise<any> {
    debug(`GateKeeper connected (name=${connectionName}, id=${connectionId}`);

    const currentTimeInSeconds: number = getCurrentTimeInSeconds();
    const expireTimestamp: number = currentTimeInSeconds + GATEKEEPER_CONNECTION_EXPIRE_TIME_IN_SECONDS;

    const input: PutItemCommandInput = {
        TableName: process.env.MERLOC_GATEKEEPER_CONNECTIONS_TABLE_NAME,
        Item: {
            'id': {S: connectionId},
            'name': {S: connectionName},
            'savedAt': {N: currentTimeInSeconds.toString()},
            'expireTimestamp': {N: expireTimestamp.toString()},
        },
    };
    const command: PutItemCommand = new PutItemCommand(input);

    try {
        await dynamodbClient.send(command);
        return generateLambdaProxyResponse(200, 'Connected');
    } catch (e) {
        error(`Unable to save gatekeeper connection`, e);
        return generateLambdaProxyResponse(500, 'Connect failed');
    }
}

async function removeGateKeeperAndClientPair(connectionName: string,
                                             clientConnectionId: string,
                                             gatekeeperConnectionId: string): Promise<any> {
    debug(`Removing pairing between gatekeeper connection (name=${connectionName}, id=${gatekeeperConnectionId} ` +
          `and client connection (name=${connectionName}, id=${clientConnectionId}`);

    const input: DeleteItemCommandInput = {
        TableName: process.env.MERLOC_CLIENT_GATEKEEPER_CONNECTION_PAIRS_TABLE_NAME,
        Key: {
            'clientConnectionId': {S: clientConnectionId},
            'gatekeeperConnectionId': {S: gatekeeperConnectionId},
        },
    };
    const command: DeleteItemCommand = new DeleteItemCommand(input);

    try {
        await dynamodbClient.send(command);
    } catch (e) {
        error(`Unable to remove pairing between gatekeeper and client connections`, e);
    }
}

async function handleGateKeeperDisconnect(event: APIGatewayEvent,
                                          connectionName: string, connectionId: string): Promise<any> {
    debug(`GateKeeper disconnected (name=${connectionName}, id=${connectionId}`);

    const input: DeleteItemCommandInput = {
        TableName: process.env.MERLOC_GATEKEEPER_CONNECTIONS_TABLE_NAME,
        Key: {
            'id': {S: connectionId},
        },
        ReturnValues: 'ALL_OLD',
    };
    const command: DeleteItemCommand = new DeleteItemCommand(input);

    try {
        const output: DeleteItemCommandOutput = await dynamodbClient.send(command);
        if (output
                && output.Attributes
                && output.Attributes.pairedClientConnectionId
                && output.Attributes.pairedClientConnectionId.S) {
            const pairedClientConnectionId: string = output.Attributes.pairedClientConnectionId.S;
            await removeGateKeeperAndClientPair(connectionName, pairedClientConnectionId, connectionId);
        }
        return generateLambdaProxyResponse(200, 'Disconnected');
    } catch (e) {
        error(`Unable to remove gatekeeper connection`, e);
        return generateLambdaProxyResponse(500, 'Disconnect failed');
    }
}

export async function handler(event: APIGatewayEvent): Promise<any> {
    debug(`On event: ${JSON.stringify(event)}`);

    const { eventType, connectionId } = event.requestContext;
    let connectionName: string | undefined = event.headers[CONNECTION_NAME_HEADER_NAME];

    if (!connectionId) {
        error(`Invalid request. Connection id is empty`);
        return generateLambdaProxyResponse(400, 'Connection id is required');
    }
    if (!connectionName) {
        error(`Invalid request. Connection name is empty`);
        return generateLambdaProxyResponse(400, 'Connection name is required');
    }

    if (eventType === CONNECT_EVENT_TYPE) {
        if (isClientConnection(connectionName)) {
            connectionName = getClientConnectionName(connectionName);
            if (connectionName) {
                return await handleClientConnect(event, connectionName, connectionId);
            }
        } else if (isGateKeeperConnection(connectionName)) {
            connectionName = getGateKeeperConnectionName(connectionName);
            if (connectionName) {
                return await handleGateKeeperConnect(event, connectionName, connectionId);
            }
        }
        error(`Invalid request. Connection name is not valid: ${connectionName}`);
        return generateLambdaProxyResponse(400, 'Invalid connection name');
    } else if (eventType === DISCONNECT_EVENT_TYPE) {
        if (isClientConnection(connectionName)) {
            connectionName = getClientConnectionName(connectionName);
            if (connectionName) {
               return await handleClientDisconnect(event, connectionName, connectionId);
            }
        } else if (isGateKeeperConnection(connectionName)) {
            connectionName = getGateKeeperConnectionName(connectionName);
            if (connectionName) {
                return await handleGateKeeperDisconnect(event, connectionName, connectionId);
            }
        }
        error(`Invalid request. Connection name is not valid: ${connectionName}`);
        return generateLambdaProxyResponse(400, 'Invalid connection name');
    } else {
        error(`Invalid request. Event type is not supported`);
        return generateLambdaProxyResponse(400, 'Invalid event type');
    }
}
