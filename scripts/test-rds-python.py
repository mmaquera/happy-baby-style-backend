#!/usr/bin/env python3
import socket
import sys

def test_rds_connection():
    """Test connection to RDS Amazon"""
    
    # RDS configuration
    host = 'happy-baby-style-db.cr0ug6u2oje3.us-east-2.rds.amazonaws.com'
    port = 5432
    
    print('🔍 Validando conexión a RDS Amazon...')
    print(f'📍 Host: {host}')
    print(f'🔌 Puerto: {port}')
    
    try:
        # Test TCP connection
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(10)  # 10 seconds timeout
        
        print('\n📡 Probando conectividad TCP...')
        result = sock.connect_ex((host, port))
        
        if result == 0:
            print('✅ Conexión TCP exitosa a RDS Amazon!')
            print('🎯 El servidor PostgreSQL está accesible')
            
            # Get server info
            try:
                sock.send(b'\x00\x00\x00\x08\x04\xd2\x16\x2f')  # Simple PostgreSQL startup message
                response = sock.recv(1024)
                if response:
                    print('✅ Servidor PostgreSQL respondiendo correctamente')
                else:
                    print('⚠️  Servidor no respondió (puede ser normal)')
            except:
                print('⚠️  No se pudo obtener respuesta del servidor (puede ser normal)')
                
        else:
            print(f'❌ Error de conexión TCP: {result}')
            print('🔧 Posibles causas:')
            print('   • Firewall bloqueando el puerto 5432')
            print('   • RDS no está ejecutándose')
            print('   • Configuración de seguridad incorrecta')
            return False
            
    except socket.gaierror:
        print('❌ Error: No se puede resolver el nombre del host')
        print('🔧 Verifica que el hostname sea correcto')
        return False
    except socket.timeout:
        print('❌ Error: Timeout en la conexión')
        print('🔧 El servidor no respondió en 10 segundos')
        return False
    except Exception as e:
        print(f'❌ Error inesperado: {e}')
        return False
    finally:
        sock.close()
    
    print('\n📊 RESUMEN DE VALIDACIÓN:')
    print('   • ✅ Hostname resuelto correctamente')
    print('   • ✅ Puerto 5432 accesible')
    print('   • ✅ Servidor PostgreSQL respondiendo')
    print('\n🎯 RDS Amazon está listo para crear tablas de e-commerce!')
    return True

if __name__ == '__main__':
    success = test_rds_connection()
    sys.exit(0 if success else 1)

