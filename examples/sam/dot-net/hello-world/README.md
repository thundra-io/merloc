# hello-world

This is the example .Net6 project for MerLoc.

## MerLoc Setup

- "npm i -g merloc-cli" install merloc-cli to your computer.

- "MERLOC_BROKER_URL: <YOUR_MERLOC_BROKER_URL>" set it into template.yml.

## Deploy the sample application

The Serverless Application Model Command Line Interface (SAM CLI) is an extension of the AWS CLI that adds functionality for building and testing Lambda applications. It uses Docker to run your functions in an Amazon Linux environment that matches Lambda. It can also emulate your application's build environment and API.

To use the SAM CLI, you need the following tools.

* SAM CLI - [Install the SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)
* .NET Core - [Install .NET Core](https://www.microsoft.com/net/download)
* Docker - [Install Docker community edition](https://hub.docker.com/search/?type=edition&offering=community)

To build and deploy your application for the first time, run the following in your shell:

```bash
sam build
sam deploy --guided
```

###### Start MerLoc and Attach Debugger

- "merloc -d -b <YOUR_MERLOC_BROKER_URL> -i sam-local -r -w '**/*.cs'" run this commnad in terminal.

- Trigger your function in order to start-up MerLoc container.

- After MerLoc docker container is bootstrapped, start vscode debugger and attach the MerLoc container and clicking "Yes" for `Attaching to container requires .NET Core debugger in the container. Do you want to copy the debugger to the container?` to allow .NET debugger copying into MerLoc container.

- Trigger your lambda function again and enjoy your debug session!


## Cleanup

To delete the sample application that you created, use the AWS CLI. Assuming you used your project name for the stack name, you can run the following:

```bash
sam delete --stack-name hello-world
```