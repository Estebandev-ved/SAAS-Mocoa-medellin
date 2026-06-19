"""
🔒 Security Firewall Module - Bot NOMA
Firewall empresarial a nivel de aplicación.
Protección contra ataques comunes y comportamiento sospechoso.
"""

import re
import time
import logging
from functools import wraps
from datetime import datetime, timedelta
from typing import Dict, Set, Tuple, Optional
from flask import request, jsonify, abort

# Configuración de logging para seguridad
security_logger = logging.getLogger('security')
security_logger.setLevel(logging.WARNING)
handler = logging.FileHandler('security.log')
handler.setFormatter(logging.Formatter('%(asctime)s [%(levelname)s] %(message)s'))
security_logger.addHandler(handler)


class SecurityFirewall:
    """
    Firewall empresarial para proteger la aplicación Flask.
    Incluye rate limiting, bloqueo de IPs, detección de ataques y sanitización.
    """
    
    def __init__(self):
        # IPs bloqueadas permanentemente
        self.blocked_ips: Set[str] = set()
        
        # Bloqueos temporales: {ip: timestamp_desbloqueo}
        self.temp_blocks: Dict[str, float] = {}
        
        # Intentos fallidos: {ip: [timestamps]}
        self.failed_attempts: Dict[str, list] = {}
        
        # Rate limiting: {ip: [timestamps]}
        self.request_history: Dict[str, list] = {}
        
        # Configuración
        self.config = {
            'max_failed_attempts': 5,          # Intentos antes de bloqueo temporal
            'failed_attempt_window': 300,       # Ventana de 5 minutos
            'temp_block_duration': 900,         # Bloqueo temporal de 15 minutos
            'rate_limit_requests': 100,         # Máximo requests por ventana
            'rate_limit_window': 60,            # Ventana de 1 minuto
            'max_message_length': 1000,         # Longitud máxima de mensaje
            'permanent_block_threshold': 3,     # Bloqueos temporales antes de permanente
        }
        
        # Contador de bloqueos temporales por IP
        self.temp_block_count: Dict[str, int] = {}
        
        # Patrones sospechosos (SQL Injection, XSS, etc.)
        self.suspicious_patterns = [
            # SQL Injection
            r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b.*\b(FROM|INTO|TABLE|SET|WHERE)\b)",
            r"(--|;|/\*|\*/|@@|@)",
            r"(\bOR\b\s+\d+\s*=\s*\d+)",
            r"(\bAND\b\s+\d+\s*=\s*\d+)",
            r"('|\")(\s*)(OR|AND)(\s*)('|\")",
            
            # XSS
            r"<script[^>]*>.*?</script>",
            r"javascript:",
            r"on\w+\s*=",
            r"<iframe",
            r"<object",
            r"<embed",
            r"<link[^>]*href",
            
            # Path Traversal
            r"\.\./",
            r"\.\.\\",
            
            # Command Injection
            r"[;&|`$]",
            r"\$\([^)]+\)",
            r"`[^`]+`",
        ]
        
        # Compilar patrones para mejor rendimiento
        self.compiled_patterns = [
            re.compile(pattern, re.IGNORECASE) for pattern in self.suspicious_patterns
        ]
        
        # User agents sospechosos/bots maliciosos
        self.blocked_user_agents = [
            'sqlmap', 'nikto', 'nessus', 'nmap', 'masscan',
            'dirbuster', 'gobuster', 'wfuzz', 'burp',
            'acunetix', 'w3af', 'zap', 'arachni',
            'python-requests', 'curl', 'wget',  # Bloquear si no tienen identificador propio
        ]
        
        # IPs de confianza (whitelist)
        self.whitelisted_ips: Set[str] = {'127.0.0.1', '::1'}
    
    def get_client_ip(self) -> str:
        """Obtiene la IP real del cliente, considerando proxies."""
        if request.headers.get('X-Forwarded-For'):
            return request.headers.get('X-Forwarded-For').split(',')[0].strip()
        if request.headers.get('X-Real-IP'):
            return request.headers.get('X-Real-IP')
        return request.remote_addr or '0.0.0.0'
    
    def is_whitelisted(self, ip: str) -> bool:
        """Verifica si la IP está en la lista blanca."""
        return ip in self.whitelisted_ips
    
    def is_blocked(self, ip: str) -> Tuple[bool, Optional[str]]:
        """
        Verifica si una IP está bloqueada.
        Retorna (bloqueado, razón).
        """
        # Bloqueo permanente
        if ip in self.blocked_ips:
            return True, "IP bloqueada permanentemente"
        
        # Bloqueo temporal
        if ip in self.temp_blocks:
            if time.time() < self.temp_blocks[ip]:
                remaining = int(self.temp_blocks[ip] - time.time())
                return True, f"IP bloqueada temporalmente. Intenta en {remaining} segundos"
            else:
                # Expiró el bloqueo temporal
                del self.temp_blocks[ip]
        
        return False, None
    
    def block_ip(self, ip: str, reason: str, permanent: bool = False):
        """Bloquea una IP temporal o permanentemente."""
        if permanent:
            self.blocked_ips.add(ip)
            security_logger.critical(f"🚫 IP BLOQUEADA PERMANENTEMENTE: {ip} - Razón: {reason}")
        else:
            self.temp_blocks[ip] = time.time() + self.config['temp_block_duration']
            self.temp_block_count[ip] = self.temp_block_count.get(ip, 0) + 1
            
            # Si excede bloqueos temporales, bloquear permanentemente
            if self.temp_block_count[ip] >= self.config['permanent_block_threshold']:
                self.block_ip(ip, f"Múltiples bloqueos temporales: {reason}", permanent=True)
            else:
                security_logger.warning(f"⏱️ IP BLOQUEADA TEMPORALMENTE: {ip} - Razón: {reason}")
    
    def record_failed_attempt(self, ip: str):
        """Registra un intento fallido de autenticación."""
        now = time.time()
        
        if ip not in self.failed_attempts:
            self.failed_attempts[ip] = []
        
        # Limpiar intentos antiguos
        window = self.config['failed_attempt_window']
        self.failed_attempts[ip] = [
            t for t in self.failed_attempts[ip] if now - t < window
        ]
        
        self.failed_attempts[ip].append(now)
        
        # Verificar si excede el límite
        if len(self.failed_attempts[ip]) >= self.config['max_failed_attempts']:
            self.block_ip(ip, "Múltiples intentos de autenticación fallidos")
            self.failed_attempts[ip] = []
    
    def check_rate_limit(self, ip: str) -> bool:
        """
        Verifica rate limiting por IP.
        Retorna True si está permitido, False si excede el límite.
        """
        now = time.time()
        window = self.config['rate_limit_window']
        
        if ip not in self.request_history:
            self.request_history[ip] = []
        
        # Limpiar requests antiguos
        self.request_history[ip] = [
            t for t in self.request_history[ip] if now - t < window
        ]
        
        # Verificar límite
        if len(self.request_history[ip]) >= self.config['rate_limit_requests']:
            security_logger.warning(f"⚠️ RATE LIMIT EXCEDIDO: {ip}")
            return False
        
        self.request_history[ip].append(now)
        return True
    
    def detect_attack_patterns(self, text: str) -> Tuple[bool, Optional[str]]:
        """
        Detecta patrones de ataque en el texto.
        Retorna (es_ataque, tipo_ataque).
        """
        if not text:
            return False, None
        
        for i, pattern in enumerate(self.compiled_patterns):
            if pattern.search(text):
                attack_types = {
                    0: "SQL Injection", 1: "SQL Injection", 2: "SQL Injection",
                    3: "SQL Injection", 4: "SQL Injection",
                    5: "XSS", 6: "XSS", 7: "XSS", 8: "XSS", 9: "XSS", 10: "XSS", 11: "XSS",
                    12: "Path Traversal", 13: "Path Traversal",
                    14: "Command Injection", 15: "Command Injection", 16: "Command Injection",
                }
                attack_type = attack_types.get(i, "Patrón sospechoso")
                return True, attack_type
        
        return False, None
    
    def validate_user_agent(self) -> bool:
        """Valida el User-Agent del request."""
        user_agent = request.headers.get('User-Agent', '').lower()
        
        if not user_agent:
            security_logger.warning(f"⚠️ Request sin User-Agent: {self.get_client_ip()}")
            return False
        
        for blocked_agent in self.blocked_user_agents:
            if blocked_agent in user_agent:
                security_logger.warning(f"🤖 Bot sospechoso detectado: {user_agent} desde {self.get_client_ip()}")
                return False
        
        return True
    
    def sanitize_input(self, text: str) -> str:
        """
        Sanitiza el input removiendo caracteres peligrosos.
        Usar como capa adicional, no como única protección.
        """
        if not text:
            return ""
        
        # Limitar longitud
        text = text[:self.config['max_message_length']]
        
        # Escapar HTML básico
        text = text.replace('<', '&lt;').replace('>', '&gt;')
        text = text.replace('"', '&quot;').replace("'", '&#x27;')
        
        # Remover caracteres de control
        text = ''.join(char for char in text if ord(char) >= 32 or char in '\n\r\t')
        
        return text.strip()
    
    def validate_content_type(self) -> bool:
        """Valida el Content-Type del request."""
        if request.method in ['POST', 'PUT', 'PATCH']:
            content_type = request.headers.get('Content-Type', '')
            
            # Para API JSON, debe ser application/json
            if request.is_json and 'application/json' not in content_type:
                return False
        
        return True
    
    def log_security_event(self, event_type: str, details: str, severity: str = 'WARNING'):
        """Registra un evento de seguridad."""
        ip = self.get_client_ip()
        user_agent = request.headers.get('User-Agent', 'Unknown')
        path = request.path
        method = request.method
        
        log_message = f"{event_type} | IP: {ip} | Path: {path} | Method: {method} | Details: {details}"
        
        if severity == 'CRITICAL':
            security_logger.critical(log_message)
        elif severity == 'ERROR':
            security_logger.error(log_message)
        elif severity == 'WARNING':
            security_logger.warning(log_message)
        else:
            security_logger.info(log_message)
    
    def check_request(self) -> Tuple[bool, Optional[str], int]:
        """
        Verifica el request completo.
        Retorna (permitido, mensaje_error, codigo_http).
        """
        ip = self.get_client_ip()
        
        # 1. Verificar whitelist
        if self.is_whitelisted(ip):
            return True, None, 200
        
        # 2. Verificar si IP está bloqueada
        blocked, reason = self.is_blocked(ip)
        if blocked:
            return False, reason, 403
        
        # 3. Verificar rate limiting
        if not self.check_rate_limit(ip):
            return False, "Demasiadas solicitudes. Intenta más tarde.", 429
        
        # 4. Verificar User-Agent (solo advertir, no bloquear)
        # self.validate_user_agent()
        
        # 5. Verificar Content-Type
        if not self.validate_content_type():
            self.log_security_event("CONTENT_TYPE_INVALID", "Content-Type inválido")
            return False, "Content-Type inválido", 400
        
        # 6. Verificar patrones de ataque en parámetros
        all_params = []
        all_params.extend(request.args.values())
        
        if request.is_json and request.json:
            all_params.extend(str(v) for v in request.json.values() if v)
        
        if request.form:
            all_params.extend(request.form.values())
        
        for param in all_params:
            is_attack, attack_type = self.detect_attack_patterns(str(param))
            if is_attack:
                self.log_security_event(
                    "ATTACK_DETECTED", 
                    f"Tipo: {attack_type}, Valor: {param[:100]}...",
                    severity='CRITICAL'
                )
                self.block_ip(ip, f"Ataque detectado: {attack_type}")
                return False, "Solicitud bloqueada por seguridad", 403
        
        return True, None, 200


# Instancia global del firewall
firewall = SecurityFirewall()


def security_middleware(f):
    """
    Decorador para proteger endpoints con el firewall.
    Usar: @security_middleware
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        allowed, message, status_code = firewall.check_request()
        
        if not allowed:
            return jsonify({'error': message}), status_code
        
        return f(*args, **kwargs)
    
    return decorated_function


def add_security_headers(response):
    """
    Agrega headers de seguridad HTTP a la respuesta.
    Usar como @app.after_request
    """
    # Prevenir MIME type sniffing
    response.headers['X-Content-Type-Options'] = 'nosniff'
    
    # Prevenir clickjacking
    response.headers['X-Frame-Options'] = 'DENY'
    
    # Habilitar protección XSS del navegador
    response.headers['X-XSS-Protection'] = '1; mode=block'
    
    # HTTP Strict Transport Security (solo HTTPS)
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    
    # Content Security Policy
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data:; "
        "connect-src 'self'"
    )
    
    # Referrer Policy
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    
    # Permissions Policy
    response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
    
    # CORS Headers
    origin = request.headers.get('Origin')
    if origin:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
    else:
        response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
    
    return response


def get_security_stats() -> dict:
    """Retorna estadísticas del firewall para el panel admin."""
    return {
        'blocked_ips': list(firewall.blocked_ips),
        'temp_blocked_ips': list(firewall.temp_blocks.keys()),
        'total_blocked': len(firewall.blocked_ips) + len(firewall.temp_blocks),
        'config': firewall.config
    }


def unblock_ip(ip: str) -> bool:
    """Desbloquea una IP."""
    if ip in firewall.blocked_ips:
        firewall.blocked_ips.remove(ip)
        security_logger.info(f"✅ IP DESBLOQUEADA: {ip}")
        return True
    if ip in firewall.temp_blocks:
        del firewall.temp_blocks[ip]
        security_logger.info(f"✅ IP DESBLOQUEADA (temporal): {ip}")
        return True
    return False


def whitelist_ip(ip: str):
    """Agrega una IP a la lista blanca."""
    firewall.whitelisted_ips.add(ip)
    security_logger.info(f"✅ IP WHITELISTED: {ip}")
