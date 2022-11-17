## Setup

1. Update `template.yaml`
    - Update `<YOUR_MERLOC_BROKER_URL>` with your own broker URL. See [here](https://github.com/thundra-io/merloc#prerequisites) about the broker setup.

2. Run `sam build` to build the lambda.
3. Run `sam deploy --guided` to deploy the lambda.
4. Install Merloc with `npm install -g merloc-cli`.
5. Run `merloc -b <YOUR_MERLOC_BROKER_URL> -i sam-local` to start Merloc.
    - See [here](https://github.com/thundra-io/merloc-cli#how-to-run) for more options on how to run Merloc CLI.
