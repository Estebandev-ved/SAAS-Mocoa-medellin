import os
from openai import AzureOpenAI, OpenAI

def get_azure_client():
    azure_key = os.getenv("AZURE_OPENAI_API_KEY", "")
    openai_key = os.getenv("OPENAI_API_KEY", "")
    
    if openai_key and not azure_key:
        return OpenAI(
            api_key=openai_key,
            timeout=15.0
        )
        
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    # Azure SDK espera solo la base, no el path completo /openai/...
    if "/openai" in endpoint:
        endpoint = endpoint.split("/openai")[0]
        
    return AzureOpenAI(
        api_key=azure_key,
        api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview"),
        azure_endpoint=endpoint,
        timeout=15.0
    )

def get_azure_model() -> str:
    azure_key = os.getenv("AZURE_OPENAI_API_KEY", "")
    openai_key = os.getenv("OPENAI_API_KEY", "")
    
    if openai_key and not azure_key:
        return os.getenv("OPENAI_MODEL", "gpt-4o")
        
    return os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-5.2-chat")

