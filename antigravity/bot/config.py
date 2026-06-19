from dotenv import load_dotenv
import os
load_dotenv()

NEGOCIO_ID = int(os.getenv('NEGOCIO_ID', '1'))

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'antigravity'),
    'port': int(os.getenv('DB_PORT', '3306')),
    'charset': 'utf8mb4',
    'autocommit': False,
    'connection_timeout': 10
}

SOCKET_URL = os.getenv('SOCKET_URL', 'http://localhost:3001')
SOCKET_SECRET = os.getenv('SOCKET_SECRET', 'interno')

DEFAULT_PRODUCT_ID = int(os.getenv('DEFAULT_PRODUCT_ID', '1'))
DEFAULT_METODO_PAGO = os.getenv('DEFAULT_METODO_PAGO', 'nequi')
PEDIDO_PREFIX = os.getenv('PEDIDO_PREFIX', 'AG')
