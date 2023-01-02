# sam-app-debug

- "npm i -g merloc-cli" install merloc-cli to your computer.

- "MERLOC_BROKER_URL: <YOUR_MERLOC_BROKER_URL>" set it into template.yml.

- sam deploy --guided

- `merloc -d -b <YOUR_MERLOC_BROKER_URL> -i sam-local -r -w '**/*.py'` run this commnad in terminal.

- Trigger lambda from console by clicking Test.

- Get local MerLoc docker port from terminal outputs and enter it in .vscode/launch.json

- Put breakpoint and enjoy your debug!