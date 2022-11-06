import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { BrokerStack } from '../lib/CoreStack';

test('Broker Stack Created', () => {
    const app = new cdk.App();

    const stack = new BrokerStack(app, 'broker-stack');

    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'merloc-client-connections'
    });
});
