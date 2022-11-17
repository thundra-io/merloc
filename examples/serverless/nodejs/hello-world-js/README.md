## Setup

1. Update `serverless.yml`
    - Update `<YOUR_MERLOC_BROKER_URL>` with your own broker URL. See [here](https://github.com/thundra-io/merloc#prerequisites) about the broker setup.

2. Run `serverless deploy --region <REGION>` to deploy the lambda.
3. Install Merloc with `npm install -g merloc-cli`.
4. Run `merloc -b <YOUR_MERLOC_BROKER_URL> -i serverless-local` to start Merloc.
    - See [here](https://github.com/thundra-io/merloc-cli#how-to-run) for more options on how to run Merloc CLI.
