from db import guardar_pedido_mysql

# Prueba directa de guardado en MySQL
print('Intentando guardar pedido de prueba...')
guardar_pedido_mysql('Prueba', 1, 'normal', 9000, metodo_pago='efectivo')
print('Si ves "Pedido guardado exitosamente en MySQL" en consola, la conexión y guardado funcionan.')
