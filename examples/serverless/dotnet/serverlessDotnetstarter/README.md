# serverlessDotNetStarter ![.NET 6](https://github.com/pharindoko/serverlessDotNetStarter/workflows/.NET%20Core/badge.svg?branch=master)

Starter template for serverless framework with following scope:

- deploy C# / NET 6 solution in **AWS cloud** using:
  - Lambda
  - Api Gateway
- debug solution locally in **Visual Studio Code** powered by Merloc.

## Prerequisites to install

- [NodeJS](https://nodejs.org/en/)
- [Serverless Framework CLI](https://serverless.com)
- [.NET Core 6](https://dotnet.microsoft.com/en-us/download/dotnet/6.0)
- [AWS-Lambda-DotNet](https://github.com/aws/aws-lambda-dotnet)
- [Visual Studio Code](https://code.visualstudio.com/)
- [C# Extension for Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=ms-vscode.csharp)

Verify that everything is installed (copy & paste)

```bash
# package manager for nodejs
npm -v
# serverless framework cli > 1.5
sls -v
# dotnet (cli) > 6.0
dotnet --version
```

## Installation (copy & paste)

```bash
# clone solution
# serverless create --template-url https://github.com/pharindoko/serverlessDotNetStarter --path {SERVICE_NAME}
serverless create --template-url https://github.com/pharindoko/serverlessDotNetStarter --path serverlessDotnetstarter
cd serverlessDotNetStarter
# restore / install dotnet references described in csproj file
dotnet restore AwsDotnetCsharp.csproj

**For VS Code Debugging:**

> ```bash
> code --install-extension ms-dotnettools.csharp --force
> ```

## Merloc Setup

- "npm i -g merloc-cli" install merloc-local to your computer.

- "MERLOC_BROKER_URL: <YOUR_MERLOC_BROKER_URL>" set it into `serverless.yml`.

## Build Package

Mac OS or Linux

```bash
./build.sh
```

Windows

```bash
build.cmd
```

## Deploy via Serverless Framework

```bash
serverless deploy
```

A cloudformation stack in AWS will be created in background containing all needed resources

#### After successful deployment you can see following output

<pre>
Service Information
service: myService
stage: dev
region: <b>{aws_region}(us-west-2)</b>
stack: myService-dev
resources: 300
api keys:
  None
endpoints:
  GET - <b>endpointUrl --> https://{api}.execute-api.{region}.amazonaws.com/dev/hello</b>
functions:
  hello: myService-dev-hello
layers:
  merloc-gatekeeper:16

</pre>

###### Destroy the stack in the cloud

```bash
sls remove
```

###### Start Merloc and Attach Debugger

- "merloc -d -b <YOUR_MERLOC_BROKER_URL> -i serverless-local --sls-reload ./build.sh -r -w '**/*.cs'" run this commnad in terminal.

- Trigger your function in order to start-up Merloc container.

- After Merloc docker container is bootstrapped, start vscode debugger and attach the merloc container and clicking "Yes" for `Attaching to container requires .NET Core debugger in the container. Do you want to copy the debugger to the container?` to allow .NET debugger copying into Merloc container.

- Trigger your lambda function again and enjoy your debug session!