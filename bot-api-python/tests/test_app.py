"""
Pruebas automáticas para los endpoints principales de app.py
Usa pytest: instala con 'pip install pytest'
Ejecuta con 'pytest tests/'
"""
import pytest
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_responder_post(client):
    # Prueba básica del endpoint /responder
    response = client.post('/responder', json={"mensaje": "Hola"})
    assert response.status_code == 200
    assert b"respuesta" in response.data

def test_responder_post_empty(client):
    # Prueba de mensaje vacío
    response = client.post('/responder', json={"mensaje": ""})
    assert response.status_code == 400
    assert b"Mensaje inv" in response.data  # Verifica que el mensaje de error esté presente
