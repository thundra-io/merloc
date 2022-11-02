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
                      principalId: string,
                      connectionType: string,
                      connectionName: string,
                      apiKey?: string): any {
    return {
        principalId: principalId,
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

function _checkAPIKey(identityKey: string, apiKey: string): string | undefined {
    // TODO
    // Implement your custom API check mechanism here.
    // Then
    //  - return principal id (user id, account id, ...) if it succeeds
    //  - or return nothing if it fails
    return identityKey;
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
    let principalId: string | undefined = identityKey;

    // TODO
    // For keeping backward compatibility with old clients and gatekeepers,
    // we are extracting/decoding connection type, name and API key from identity key passed over `x-api-key` header.
    // While keeping support of this protocol for backward compatibility, we might also add another mechanism
    // by passing connection type, name and API key through custom headers individually.
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

    debug(`Connection type: ${connectionType}, connection name: ${connectionName}, API key: ${apiKey}`);

    if (!connectionType) {
        error('Invalid auth request. Connection type could not be detected');
        return _denyAccess(event);
    }

    if (!connectionName) {
        error('Invalid auth request. Connection name could not be detected');
        return _denyAccess(event);
    }

    if (process.env.MERLOC_BROKER_AUTHORIZER_API_KEY_CHECK_ENABLE === 'true') {
        if (apiKey) {
            principalId = _checkAPIKey(identityKey, apiKey);
            if (!principalId) {
                error(`Invalid auth request. API key check failed: ${apiKey}`);
                return _denyAccess(event);
            }
        } else {
            error('Invalid auth request. API key is required');
            return _denyAccess(event);
        }
    }

    return _allowAccess(event, principalId, connectionType, connectionName, apiKey);
}
