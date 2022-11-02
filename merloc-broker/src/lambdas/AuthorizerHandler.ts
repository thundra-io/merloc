import { APIGatewayEvent } from 'aws-lambda';
import { debug, error } from './Logger';
import {
    CLIENT_CONNECTION_TYPE,
    GATEKEEPER_CONNECTION_TYPE,
    getClientConnectionName,
    getConnectionAPIKey,
    getGateKeeperConnectionName,
    isClientConnection,
    isGateKeeperConnection
} from './Utils';

function _denyAccess(event: APIGatewayEvent): any {
    return {
        policyDocument: {
            Version: '2012-10-17',
            Statement: [
                {
                    Action: 'execute-api:Invoke',
                    Effect: 'Deny',
                    Resource: event.methodArn
                }
            ]
        }
    }
}

function _allowAccess(event: APIGatewayEvent,
                      identityKey: string,
                      connectionType: string,
                      connectionName: string,
                      apiKey?: string): any {
    return {
        principalId: identityKey,
        policyDocument: {
            Version: '2012-10-17',
            Statement: [
                {
                    Action: 'execute-api:Invoke',
                    Effect: 'Allow',
                    Resource: event.methodArn
                }
            ]
        },
        context: {
            connectionType,
            connectionName,
            apiKey,
        }
    }
}

export async function handler(event: APIGatewayEvent): Promise<any> {
    debug(`Received auth request: ${JSON.stringify(event)}`);

    const identityKey: string | null = event?.requestContext?.identity?.apiKey;
    if (!identityKey) {
        error('Invalid auth request. Identity key is not exist');
        return _denyAccess(event);
    }

    let connectionType: string | undefined;
    let connectionName: string | undefined;
    let apiKey: string | undefined;

    if (isClientConnection(identityKey)) {
        connectionType = CLIENT_CONNECTION_TYPE;
        connectionName = getClientConnectionName(identityKey);
        if (connectionName) {
            apiKey = getConnectionAPIKey(connectionName);
        }
    } else if (isGateKeeperConnection(identityKey)) {
        connectionType = GATEKEEPER_CONNECTION_TYPE;
        connectionName = getGateKeeperConnectionName(identityKey);
        if (connectionName) {
            apiKey = getConnectionAPIKey(connectionName);
        }
    }

    if (!connectionType) {
        error(`Invalid auth request. Connection type is not valid: ${connectionType}`);
        return _denyAccess(event);
    }

    if (!connectionName) {
        error(`Invalid auth request. Connection name is not valid: ${connectionName}`);
        return _denyAccess(event);
    }

    if (process.env.MERLOC_BROKER_AUTHORIZER_API_KEY_REQUIRED === 'true' && !apiKey) {
        error('Invalid auth request. API key is required');
        return _denyAccess(event);
    }

    return _allowAccess(event, identityKey, connectionType, connectionName, apiKey);
}
