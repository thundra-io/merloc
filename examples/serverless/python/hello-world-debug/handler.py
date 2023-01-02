import json
import os

if "IS_LOCAL" in os.environ and os.environ["IS_LOCAL"]:
    import ptvsd
    ptvsd.enable_attach(address=('0.0.0.0', os.environ["MERLOC_DOCKER_DEBUG_PORT"]), redirect_output=True)
    ptvsd.wait_for_attach()

def hello(event, context):
    body = {
        "message": "Go Serverless v3.0! Your function executed successfully!",
        "input": event,
    }

    return {"statusCode": 200, "body": json.dumps(body)}
