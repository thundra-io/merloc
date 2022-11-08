# Run

- create virtual env "virtualenv .venv"

- Set it as Python interpreter

- Run "pip install -r requirements.txt"

- "sls plugin install -n serverless-python-requirements" install sls python requirements plugin

- Deploy on aws with "sls deploy"

- merloc -d -b <YOUR_MERLOC_BROKER_URK> -i serverless-local -r -w '**/*.py'

- After trigger your lambda function, get local Docker Port from terminal and set it into .vscode/launch.json.

- Start debugging session on Vscode and put breakpoint into handler.hello function.

- Trigger your lambda and enjoy debug!