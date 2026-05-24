# README – Renovación automática del certificado SSL (Let’s Encrypt)  
**Dominio:** `service.happybabystyle.com`  
**Servidor:** Amazon Linux 2 / Amazon Linux 2023 / EC2 con NGINX + PM2  

### Estado actual (Noviembre 2025)
- Certificado: Let’s Encrypt  
- Ruta: `/etc/letsencrypt/live/service.happybabystyle.com/`  
- NGINX ya está bien configurado (usa `fullchain.pem` → Android funciona cuando el cert está vigente)

### Cómo renovar MANUALMENTE (cuando ya está caducado y falla Android)

```bash
# Opción 1 – La más rápida (para cuando estás apurado)
sudo systemctl stop nginx
sudo certbot renew --force-renewal
sudo systemctl start nginx

# Opción 2 – Sin parar nada (si tienes una carpeta webroot)
sudo certbot renew --force-renewal --webroot -w /var/www/html
```

### Renovación AUTOMÁTICA para que NUNCA más te pase (recomendado)

#### 1. Cambiar a desafío TLS-ALPN-01 (usa el puerto 443, no necesita tocar el 80)

```bash
sudo nano /etc/letsencrypt/renewal/service.happybabystyle.com.conf
```

Añade o modifica estas líneas dentro del archivo:

```ini
preferred_challenges = tls-alpn-01
```

Guarda y cierra (Ctrl+O → Enter → Ctrl+X).

#### 2. Probar que funciona

```bash
sudo certbot renew --dry-run
```

Debe salir: `Simulating renewal... Cert not yet due` o `Congratulations`.

#### 3. Activar el timer automático de Certbot (se ejecuta 2 veces al día)

```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

#### 4. Verificar que está activo

```bash
sudo systemctl status certbot.timer
```

Debe decir `active (waiting)`.

Con esto tu certificado se renueva automáticamente cada ~60–80 días sin que tengas que tocar nada nunca más.

### Comandos útiles (guárdatelos)

```bash
# Ver fecha de caducidad actual
sudo certbot certificates | grep -A 3 service.happybabystyle.com

# Forzar renovación manual (solo cuando necesites ya mismo)
sudo systemctl stop nginx && sudo certbot renew --force-renewal && sudo systemctl start nginx

# Probar renovación automática (no renueva si no es necesario)
sudo certbot renew --dry-run

# Ver logs de la última renovación
sudo cat /var/log/letsencrypt/letsencrypt.log | tail -20
```

### Resumen final (copia y pega esto en tu servidor)

```bash
# 1. Cambiar a renovación por TLS (una sola vez)
sudo sed -i '/^\[renewalparams\]/a preferred_challenges = tls-alpn-01' /etc/letsencrypt/renewal/service.happybabystyle.com.conf

# 2. Activar renovación automática
sudo systemctl enable --now certbot.timer

# 3. Probar
sudo certbot renew --dry-run && echo "Todo perfecto, renovación automática activada"
```

Con esto ya nunca más tendrás que renovar el certificado a mano ni verás el error  
`javax.net.ssl.SSLHandshakeException: Chain validation failed` en Android.

¡Listo! Guarda este README en tu servidor (por ejemplo en `/home/ec2-user/README_SSL.md`) para que cualquier compañero o tú en el futuro lo tenga a mano.