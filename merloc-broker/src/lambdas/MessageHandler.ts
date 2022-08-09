import { APIGatewayEvent } from 'aws-lambda';
import {
    DynamoDBClient,
    GetItemCommand,
    GetItemCommandInput,
    GetItemOutput,
    PutItemCommandInput,
    TransactWriteItemsCommand,
    TransactWriteItemsCommandInput,
} from '@aws-sdk/client-dynamodb';
import {
    debug,
    error,
} from './Logger';
import {
    CLIENT_CONNECTION_TYPE,
    BROKER_ERROR_MESSAGE_TYPE,
    DEFAULT_CLIENT_CONNECTION_NAME,
    GATEKEEPER_CONNECTION_EXPIRE_TIME_IN_SECONDS,
    CLIENT_GATEKEEPER_CONNECTION_PAIR_EXPIRE_TIME_IN_SECONDS,
    generateLambdaProxyResponse,
    postToConnection,
    buildBrokerEnvelope, getCurrentTimeInSeconds,
} from './Utils';
import { BrokerEnvelope } from './BrokerEnvelope';

const dynamodbClient = new DynamoDBClient({ });

async function findAssociatedClientConnectionId(connectionName: string): Promise<string | undefined> {
    const input: GetItemCommandInput = {
        TableName: process.env.MERLOC_CLIENT_CONNECTIONS_TABLE_NAME,
        Key: {
            'name': {S: connectionName}
        },
        ConsistentRead: true,
    };
    const command: GetItemCommand = new GetItemCommand(input);
    const output: GetItemOutput = await dynamodbClient.send(command);
    if (output && output.Item && output.Item.id && output.Item.id.S) {
        return output.Item.id.S;
    }
    return undefined;
}

async function saveGateKeeperAndClientPair(connectionName: string,
                                           clientConnectionId: string,
                                           gatekeeperConnectionId: string): Promise<any> {
    debug(`GateKeeper connection (name=${connectionName}, id=${gatekeeperConnectionId} ` +
          `is pairing with client connection (name=${connectionName}, id=${clientConnectionId}`);

    const currentTimeInSeconds: number = getCurrentTimeInSeconds();
    const gatekeeperConnectionExpireTimestamp: number =
        currentTimeInSeconds + GATEKEEPER_CONNECTION_EXPIRE_TIME_IN_SECONDS;
    const clientGatekeeperConnectionPairExpireTimestamp: number =
        currentTimeInSeconds + CLIENT_GATEKEEPER_CONNECTION_PAIR_EXPIRE_TIME_IN_SECONDS;

    const input1: PutItemCommandInput = {
        TableName: process.env.MERLOC_GATEKEEPER_CONNECTIONS_TABLE_NAME,
        Item: {
            'id': {S: gatekeeperConnectionId},
            'name': {S: connectionName},
            'pairedClientConnectionId': {S: clientConnectionId},
            'savedAt': {N: currentTimeInSeconds.toString()},
            'expireTimestamp': {N: gatekeeperConnectionExpireTimestamp.toString()},
        },
    };
    const input2: PutItemCommandInput = {
        TableName: process.env.MERLOC_CLIENT_GATEKEEPER_CONNECTION_PAIRS_TABLE_NAME,
        Item: {
            'clientConnectionId': {S: clientConnectionId},
            'gatekeeperConnectionId': {S: gatekeeperConnectionId},
            'savedAt': {N: currentTimeInSeconds.toString()},
            'expireTimestamp': {N: clientGatekeeperConnectionPairExpireTimestamp.toString()},
        },
    };
    const input: TransactWriteItemsCommandInput = {
        TransactItems: [
            {
                Put: {
                    ...input1
                }
            },
            {
                Put: {
                    ...input2
                }
            }
        ]
    }
    const command: TransactWriteItemsCommand = new TransactWriteItemsCommand(input);

    try {
        await dynamodbClient.send(command);
        debug(`Paired gatekeeper connection (id=${gatekeeperConnectionId}) ` +
              `with client connection (id=${clientConnectionId}`);
    } catch (e) {
        error(`Couldn't pair gatekeeper connection (id=${gatekeeperConnectionId}) ` +
              `with client connection (id=${clientConnectionId}`,
              e);
    }
}

async function forwardToClient(event: APIGatewayEvent, envelop: BrokerEnvelope,
                               connectionName: string, connectionId: string) {
    let clientConnectionId: string | undefined;
    try {
        debug(`Checking client connection with name ${connectionName} ...`);
        clientConnectionId = await findAssociatedClientConnectionId(connectionName);
        if (!clientConnectionId) {
            debug(`No client connection could be found with name ${connectionName}`);
            debug(`Checking default client connection ...`);
            clientConnectionId = await findAssociatedClientConnectionId(DEFAULT_CLIENT_CONNECTION_NAME);
            if (!clientConnectionId) {
                debug(`No default client connection could be found`);
                const brokerEnvelope: BrokerEnvelope =
                    buildErrorEnvelope(
                        connectionId, envelop,
                        'NoClientConnectionFound',
                        `No client connection could be found either with name ${connectionName} or default`,
                        404);
                await postToConnection(event, brokerEnvelope, connectionId);
                return generateLambdaProxyResponse(404, 'No client connection exist');
            }
        }
    } catch (e) {
        error(`Unable to get client connection with name ${connectionName}`, e);
        const brokerEnvelope: BrokerEnvelope =
            buildErrorEnvelope(
                connectionId, envelop,
                'GetClientConnectionFailed',
                `Unable to get client connection with name ${connectionName}: ${e.message}`,
                500);
        await postToConnection(event, brokerEnvelope, connectionId);
        return generateLambdaProxyResponse(500, 'Could not get client connection');
    }

    await saveGateKeeperAndClientPair(connectionName, clientConnectionId, connectionId);

    try {
        debug(`Forwarding message to client connection (name=${connectionName}, id=${clientConnectionId}) ...`);
        envelop.sourceConnectionId = event.requestContext.connectionId;
        await postToConnection(event, envelop, clientConnectionId);
        debug(`Forwarded message to client connection (name=${connectionName}, id=${clientConnectionId})`);
        return generateLambdaProxyResponse(200, 'Ok');
    } catch (e) {
        error(`Unable to forward message to client connection (name=${connectionName}, id=${clientConnectionId})`, e);
        const brokerEnvelope: BrokerEnvelope =
            buildErrorEnvelope(
                connectionId, envelop,
                'ForwardToClientFailed',
                `Unable to forward message to client connection (name=${connectionName}, id=${clientConnectionId}): ${e.message}`,
                500);
        await postToConnection(event, brokerEnvelope, connectionId);
        return generateLambdaProxyResponse(500, 'Could not forward message to client connection');
    }
}

async function forwardToTarget(event: APIGatewayEvent, envelop: BrokerEnvelope,
                               connectionName: string, connectionId: string) {
    const { targetConnectionId } = envelop;

    if (!targetConnectionId) {
        error(`Invalid request. Target connection id is empty`);
        const brokerEnvelope: BrokerEnvelope =
            buildErrorEnvelope(
                connectionId, envelop,
                'InvalidRequest', `Invalid request. Target connection id is empty`, 400);
        await postToConnection(event, brokerEnvelope, connectionId);
        return generateLambdaProxyResponse(400, 'Target connection id is required');
    }

    try {
        debug(`Forwarding message to target connection (name=${connectionName}, id=${targetConnectionId}) ...`);
        envelop.sourceConnectionId = event.requestContext.connectionId;
        await postToConnection(event, envelop, targetConnectionId);
        debug(`Forwarded message to target connection (name=${connectionName}, id=${targetConnectionId})`);
        return generateLambdaProxyResponse(200, 'Ok');
    } catch (e) {
        error(`Unable to forward message to target connection (name=${connectionName}, id=${targetConnectionId})`, e);
        const brokerEnvelope: BrokerEnvelope =
            buildErrorEnvelope(
                connectionId, envelop,
                'ForwardToTargetFailed',
                `Unable to forward message to client connection (name=${connectionName}, id=${targetConnectionId}): ${e.message}`,
                500);
        await postToConnection(event, brokerEnvelope, connectionId);
        return generateLambdaProxyResponse(500, 'Could not forward message to target connection');
    }
}

function buildErrorEnvelope(connectionId: string, requestEnvelope: BrokerEnvelope,
                            errorType: string, errorMessage: string, errorCode: number): BrokerEnvelope {
    return buildBrokerEnvelope(
        BROKER_ERROR_MESSAGE_TYPE,
        requestEnvelope.connectionName,
        connectionId,
        requestEnvelope.id,
        requestEnvelope.sourceConnectionType,
        null,
        {
            type: errorType,
            message: errorMessage,
            code: errorCode,
            internal: true,
        }
    )
}

export async function handler(event: APIGatewayEvent) {
    debug(`Received event: ${JSON.stringify(event)}`);

    if (!event.requestContext.connectionId) {
        return generateLambdaProxyResponse(400, 'No connection id could be found in the event');
    }

    if (!event.body) {
        return generateLambdaProxyResponse(400, 'No body could be found in the event');
    }

    try {
        const connectionId: string = event.requestContext.connectionId;
        const envelope: BrokerEnvelope = JSON.parse(event.body);
        const { targetConnectionType, connectionName } = envelope;

        if (!connectionName) {
            error(`Invalid request. Connection name is empty`);
            const brokerEnvelope: BrokerEnvelope =
                buildErrorEnvelope(
                    connectionId, envelope,
                    'InvalidRequest', `Invalid request. Connection name is empty`, 400);
            await postToConnection(event, brokerEnvelope, connectionId);
            return generateLambdaProxyResponse(400, 'Connection name is required');
        }

        if (targetConnectionType === CLIENT_CONNECTION_TYPE) {
            return await forwardToClient(event, envelope, connectionName, connectionId);
        } else {
            return await forwardToTarget(event, envelope, connectionName, connectionId);
        }
    } catch (e) {
        error(`Unable to handle event`, e);
        return generateLambdaProxyResponse(500, 'Unable to handle event');
    }
}
