// @ts-ignore
import { v4 as uuidv4 } from 'uuid';
import {APIGatewayEvent} from "aws-lambda";
import {
    ApiGatewayManagementApiClient,
    PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import {
    BrokerEnvelope,
    BrokerPayload,
    Error,
} from './BrokerEnvelope';

export const CONNECT_EVENT_TYPE = 'CONNECT';
export const DISCONNECT_EVENT_TYPE = 'DISCONNECT';

export const CONNECTION_NAME_HEADER_NAME = 'x-api-key';
export const CLIENT_CONNECTION_NAME_PREFIX = 'client::';
export const DEFAULT_CLIENT_CONNECTION_NAME = 'default';
export const GATEKEEPER_CONNECTION_NAME_PREFIX = 'gatekeeper::';

export const BROKER_CONNECTION_TYPE = 'broker';
export const CLIENT_CONNECTION_TYPE = 'client';
export const GATEKEEPER_CONNECTION_TYPE = "gatekeeper";

export const CLIENT_PING_MESSAGE_TYPE = 'client.ping';
export const CLIENT_PONG_MESSAGE_TYPE = 'client.pong';
export const CLIENT_REQUEST_MESSAGE_TYPE = 'client.request';
export const CLIENT_RESPONSE_MESSAGE_TYPE = 'client.response';
export const CLIENT_DISCONNECT_MESSAGE_TYPE = 'client.disconnect';
export const CLIENT_ERROR_MESSAGE_TYPE = 'client.error';
export const CLIENT_CONNECTION_OVERRIDE_MESSAGE_TYPE = 'client.connectionOverride';
export const BROKER_ERROR_MESSAGE_TYPE = 'broker.error';

export const CLIENT_CONNECTION_EXPIRE_TIME_IN_SECONDS = 1 * 24 * 60 * 60; // 1 day
export const GATEKEEPER_CONNECTION_EXPIRE_TIME_IN_SECONDS = 30 * 60; // 30 minutes
export const CLIENT_GATEKEEPER_CONNECTION_PAIR_EXPIRE_TIME_IN_SECONDS = 30 * 60; // 30 minutes

export function generateId(): string {
    return uuidv4();
}

export function getCurrentTimeInSeconds(): number {
    return Math.floor(Date.now() / 1000);
}

export function getCurrentTimeInMilliSeconds(): number {
    return Date.now();
}

export function generateLambdaProxyResponse(httpCode: number, jsonBody: string) {
    return {
        body: jsonBody,
        statusCode: httpCode,
    };
}

function convertData(data: any): any {
    if (typeof data === 'string') {
        return data;
    } else if (Buffer.isBuffer(data)) {
        return data;
    } else {
        return JSON.stringify(data);
    }
}

export async function postToConnection(event: APIGatewayEvent, data: any, connectionId: string) {
    // We are not using `event.requestContext.domainName` here,
    // because in case of custom domain usage,
    // we should not use custom domain name but API GW endpoint URL.
    const apiDomainName: string = `${event.requestContext.apiId}.execute-api.${process.env.AWS_REGION}.amazonaws.com`;
    const apigwManagementApi = new ApiGatewayManagementApiClient({
        apiVersion: '2018-11-29',
        endpoint: `https://${apiDomainName}/${event.requestContext.stage}`,
    });
    try {
        const input = {
            ConnectionId: connectionId,
            Data: convertData(data),
        };
        const command = new PostToConnectionCommand(input);

        await apigwManagementApi.send(command);
    } finally {
        apigwManagementApi.destroy();
    }
}

export function buildBrokerEnvelope(type: string, connectionName: string, targetConnectionId: string,
                                    responseOf?: string, targetConnectionType?: string,
                                    data?: any, error?: Error): BrokerEnvelope {
    const brokerPayload: BrokerPayload = {
        data,
        error,
    };
    // TODO Handle fragmentation when needed
    return {
        id: generateId(),
        connectionName,
        responseOf,
        sourceConnectionType: BROKER_CONNECTION_TYPE,
        targetConnectionId,
        targetConnectionType,
        type,
        payload: JSON.stringify(brokerPayload),
        fragmented: false,
        fragmentNo: -1,
        fragmentCount: -1,
    }
}
