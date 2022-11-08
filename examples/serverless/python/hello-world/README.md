# Run

- "sls plugin install -n serverless-python-requirements" install sls python requirements plugin

- Deploy on aws with "sls deploy"

- merloc -b <YOUR_MERLOC_BROKER_URK> -i serverless-local -r -w '**/*.py'

- Trigger your lambda function and check terminal outputs.

- change the handler.hello function and save it.

- see your lambda function is reloaded from terminal console.

- Trigger your lambda function again and see the hot reload work.