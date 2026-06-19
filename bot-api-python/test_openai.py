import os
from openai import AzureOpenAI
from dotenv import load_dotenv

load_dotenv()

try:
    print(f"API_KEY: {os.getenv('OPENAI_API_KEY')[:5]}...")
    print(f"ENDPOINT: {os.getenv('OPENAI_ENDPOINT')}")
    client = AzureOpenAI(
        api_key=os.getenv("OPENAI_API_KEY"),
        api_version="2025-03-01-preview",
        azure_endpoint=os.getenv("OPENAI_ENDPOINT")
    )
    # The actual method call in main.py
    print("Testing client.chat.completions.create...")
    response = client.chat.completions.create(
        model=os.getenv("OPENAI_DEPLOYMENT", "gpt-5.2-chat"),
        messages=[{"role": "user", "content": "Hola"}]
    )
    print("Success chat!")
    print(response)
except Exception as e:
    print(f"Exception using chat.completions: {type(e).__name__} - {e}")
    
try:
    print("\nTesting client.responses.create...")
    response = client.responses.create(
        model=os.getenv("OPENAI_DEPLOYMENT", "gpt-5.2-chat"),
        instructions="Eres un asistente.",
        input="Hola"
    )
    print("Success responses!")
    print(response)
except Exception as e:
    print(f"Exception using responses.create: {type(e).__name__} - {e}")
