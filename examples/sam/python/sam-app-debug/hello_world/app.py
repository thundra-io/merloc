import json
import os
# import requests

if "AWS_SAM_LOCAL" in os.environ and os.environ["AWS_SAM_LOCAL"]:
    import ptvsd
    ptvsd.enable_attach(address=('0.0.0.0', os.environ["MERLOC_DOCKER_DEBUG_PORT"]), redirect_output=True)
    ptvsd.wait_for_attach()

def lambda_handler(event, context):
    """Sample pure Lambda function

    Parameters
    ----------
    event: dict, required
        API Gateway Lambda Proxy Input Format

        Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format

    context: object, required
        Lambda Context runtime methods and attributes

        Context doc: https://docs.aws.amazon.com/lambda/latest/dg/python-context-object.html

    Returns
    ------
    API Gateway Lambda Proxy Output Format: dict

        Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
    """

    # try:
    #     ip = requests.get("http://checkip.amazonaws.com/")
    # except requests.RequestException as e:
    #     # Send some context about this error to Lambda Logs
    #     print(e)

    #     raise e

    response_message = "hello from otherside!"

    response = {
        "statusCode": 200,
        "body": json.dumps({
            "message": response_message,
            # "location": ip.text.replace("\n", "")
        }),
    }

    return response
