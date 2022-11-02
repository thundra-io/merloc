import { APIGatewayEvent } from 'aws-lambda';
import {
    info,
    debug,
    error,
} from './Logger';

export async function handler(event: APIGatewayEvent): Promise<any> {
    info(`Event: ${JSON.stringify(event)}`);

    return {
        principalId: "user|1",
        policyDocument: {
            Version: "2012-10-17",
            Statement: [
                {
                    Action: "execute-api:Invoke",
                    Effect: "Allow",
                    Resource: "*"
                }
            ]
        },
        context: {
            "key": "val"
        }
    }
}
