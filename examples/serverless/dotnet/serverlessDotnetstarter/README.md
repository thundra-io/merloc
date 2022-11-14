# serverlessDotNetStarter ![.NET 6](https://github.com/pharindoko/serverlessDotNetStarter/workflows/.NET%20Core/badge.svg?branch=master)

Starter template for serverless framework with following scope:

- deploy C# / NET 6 solution in **AWS cloud** using:
  - Lambda
  - Api Gateway
- debug and test solution locally in **Visual Studio Code**
- works operating system independent

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
region: <b>us-west-2</b>
stack: myService-dev
resources: 300
api keys:
  None
endpoints:
  GET - <b>endpointUrl --> https://{api}.execute-api.us-east-1.amazonaws.com/dev/hello</b>
functions:
  hello: myService-dev-hello
layers:
  None

</pre>

**Mind:** For a successful response of function getquerystring the querystringParameter **foo** must be inserted

## FAQ

###### Can I use the solution with Visual Studio IDE (2017 or 2019)

1. Yes. [Here`s the guideline.](https://github.com/aws/aws-lambda-dotnet/tree/master/Tools/LambdaTestTool#configure-for-visual-studio)

###### How to add an api key

1. Setup API Key in serverless.yml file
   <https://serverless.com/framework/docs/providers/aws/events/apigateway/#setting-api-keys-for-your-rest-api>

###### How to add additional lambda functions

1. Create a new C# Function in Handler.cs or use another file
2. Add a new function to serverless.yml and reference the C# Function as handler
   <https://serverless.com/framework/docs/providers/aws/guide/functions/>

###### Destroy the stack in the cloud

```bash
sls remove
```

###### I deployed the solution but I get back a http 500 error

1. Check Cloudwatch Logs in AWS - the issue should be describe there.
2. For a successful response of function getquerystring the querystringParameter **foo** must be inserted

###### How can I change the lambda region or stack name

Please have a look to the serverless guideline: <https://serverless.com/framework/docs/providers/aws/guide/deploying/>
