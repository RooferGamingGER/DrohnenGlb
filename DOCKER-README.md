
# DrohnenGLB Docker Setup

Diese Anleitung hilft dir, die DrohnenGLB-Anwendung mit Docker auf einem Ubuntu-Server zu installieren und zu betreiben.

## Voraussetzungen

- Ubuntu Server (empfohlen: Ubuntu 20.04 LTS oder neuer)
- Docker installiert
- Docker Compose installiert
- Git installiert
- Domain, die auf den Server verweist (für SSL)

## Installation auf Ubuntu Server

### 1. System-Updates installieren

```bash
sudo apt update
sudo apt upgrade -y
```

### 2. Docker installieren (falls noch nicht installiert)

```bash
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
sudo apt update
sudo apt install -y docker-ce
sudo usermod -aG docker $USER
```

### 3. Docker Compose installieren (falls noch nicht installiert)

```bash
sudo curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 4. Anwendung klonen und vorbereiten

```bash
git clone <repository-url> dronenglb
cd dronenglb

# Verzeichnisstruktur für SSL erstellen
mkdir -p nginx/ssl
mkdir -p certbot/conf
mkdir -p certbot/www
```

### 5. Umgebungsvariablen anpassen

Bearbeiten Sie die docker-compose.yml Datei:

```bash
nano docker-compose.yml
```

Ändern Sie die folgenden Werte:
- `JWT_SECRET`: Ersetzen Sie durch einen sicheren zufälligen String
- `ADMIN_PASSWORD`: Geben Sie ein sicheres Passwort für den Administrator an
- Bei certbot: Ersetzen Sie example.com mit Ihrer Domain

### 6. SSL-Zertifikate einrichten

```bash
# Nur Web-Server starten
sudo docker-compose up -d app

# Certbot ausführen (Domain anpassen!)
sudo docker-compose run --rm certbot certonly --webroot --webroot-path=/var/www/certbot -d example.com -d www.example.com
```

### 7. HTTPS aktivieren

Bearbeiten Sie die nginx.conf und entfernen Sie die Kommentarzeichen vom HTTPS-Server-Block:

```bash
nano nginx.conf
```

### 8. Docker Container starten

```bash
sudo docker-compose down
sudo docker-compose up -d
```

Der Admin-Benutzer info@drohnenvermessung-roofergaming.de wird automatisch erstellt, wenn die Container starten.

## Zertifikatserneuerung

Let's Encrypt-Zertifikate laufen nach 90 Tagen ab. Richten Sie einen Cron-Job ein:

```bash
sudo crontab -e
```

Fügen Sie hinzu:
```
0 3 * * * cd /pfad/zu/dronenglb && docker-compose run --rm certbot renew --quiet && docker-compose exec app nginx -s reload
```

## Datensicherung

### Datenbank sichern

```bash
sudo docker-compose exec db pg_dump -U postgres dronenglb > backup_$(date +%Y%m%d).sql
```

### Dateiuploads sichern

```bash
sudo tar -czvf uploads_backup_$(date +%Y%m%d).tar.gz backend/uploads/
```

### Zertifikate sichern

```bash
sudo tar -czvf certbot_backup_$(date +%Y%m%d).tar.gz certbot/
```

## Fehlersuche

### Logs anzeigen

```bash
# Alle Container-Logs
sudo docker-compose logs

# Logs eines bestimmten Services
sudo docker-compose logs api
sudo docker-compose logs db
sudo docker-compose logs app
```

### Container neustarten

```bash
sudo docker-compose restart api
```

## Speicherplatz freigeben (bei Bedarf)

```bash
# Nicht verwendete Docker-Ressourcen bereinigen
sudo docker system prune -a
```

## Sicherheitshinweise

1. Ändern Sie das JWT_SECRET in der docker-compose.yml zu einem sicheren Wert
2. Setzen Sie sichere Passwörter für die Datenbank und den Admin-Benutzer
3. Konfigurieren Sie eine Firewall und erlaube nur die benötigten Ports (80, 443, SSH)
4. Aktivieren Sie HTTPS mit Let's Encrypt wie beschrieben

Für eine umfassendere Anleitung, siehe die INSTALLATION.md Datei.
