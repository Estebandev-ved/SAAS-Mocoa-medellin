import os
from dotenv import load_dotenv
from openai import AzureOpenAI

# Load .env
load_dotenv()

endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "")
api_key = os.getenv("AZURE_OPENAI_API_KEY", "")
deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-5.2-chat")

print("Original Endpoint:", endpoint)
print("API Key exists:", bool(api_key))
print("Deployment:", deployment)

if "/openai" in endpoint:
    endpoint = endpoint.split("/openai")[0]

print("Cleaned Endpoint:", endpoint)

try:
    client = AzureOpenAI(
        api_key=api_key,
        api_version="2024-02-15-preview",
        azure_endpoint=endpoint,
        timeout=10.0 # Set a shorter timeout for testing
    )
    
    print("Sending chat completion request...")
    response = client.chat.completions.create(
        model=deployment,
        messages=[
            {"role": "user", "content": "Hola, responde con la palabra 'OK' si recibes esto."}
        ]
    )
    print("Response:")
    print(response.choices[0].message.content)
except Exception as e:
    print("Error during request:")
    print(e)
