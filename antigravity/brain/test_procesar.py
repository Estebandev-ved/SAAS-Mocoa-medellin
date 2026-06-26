import requests
import json

url = "http://localhost:8000/procesar"
payload = {
    "mensaje": "Hola",
    "contexto": [],
    "negocio_id": 1,
    "cliente_id": 1
}

print(f"Sending POST request to {url}...")
try:
    response = requests.post(url, json=payload, timeout=20.0)
    print("Status Code:", response.status_code)
    print("Response JSON:")
    print(json.dumps(response.json(), indent=2))
except Exception as e:
    print("Error connecting to Python brain:")
    print(e)
