import os
from openai import AzureOpenAI

def get_azure_client() -> AzureOpenAI:
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    # Azure SDK espera solo la base, no el path completo /openai/...
    if "/openai" in endpoint:
        endpoint = endpoint.split("/openai")[0]
        
    return AzureOpenAI(
        api_key=os.getenv("AZURE_OPENAI_API_KEY"),
        api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview"),
        azure_endpoint=endpoint
    )

def get_azure_model() -> str:
    return os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-5.2-chat")
