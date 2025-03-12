
# DrohnenGLB Installation Guide

Diese Anleitung führt Sie durch die Installation der DrohnenGLB-Anwendung auf einem Ubuntu Server mit Docker und SSL-Konfiguration.

## Voraussetzungen

- Ubuntu Server 20.04 LTS oder neuer
- Mindestens 2 GB RAM und 20 GB Speicherplatz
- Eine Domain, die auf den Server verweist (für SSL)
- Root- oder sudo-Berechtigungen

## 1. System aktualisieren

Verbinden Sie sich mit Ihrem Server und führen Sie folgende Befehle aus:

```bash
sudo apt update
sudo apt upgrade -y
```

## 2. Docker und Docker Compose installieren

```bash
# Docker installieren
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
sudo apt update
sudo apt install -y docker-ce
sudo usermod -aG docker $USER

# Docker Compose installieren
sudo curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

Damit die Gruppenmitgliedschaft wirksam wird, melden Sie sich neu an oder starten Sie Ihre SSH-Sitzung neu.

## 3. Anwendung herunterladen

```bash
# Anwendung klonen
git clone <repository-url> dronenglb
cd dronenglb
```

## 4. Konfiguration anpassen

### Admin-Benutzer und JWT-Secret konfigurieren

```bash
# Sicheres JWT-Secret generieren
JWT_SECRET=$(openssl rand -base64 32)

# Verzeichnisstruktur für Zertifikate erstellen
mkdir -p nginx/ssl
mkdir -p certbot/conf
mkdir -p certbot/www
```

Bearbeiten Sie die Datei `docker-compose.yml` und passen Sie folgende Werte an:

```bash
nano docker-compose.yml
```

Ändern Sie diese Werte:
- `JWT_SECRET`: Ersetzen Sie `replace_this_with_secure_random_string` durch das generierte JWT-Secret
- `ADMIN_PASSWORD`: Ändern Sie `change_this_secure_password` zu einem sicheren Passwort
- In der certbot-Konfiguration: Ersetzen Sie `example.com` und `www.example.com` mit Ihrer Domain

## 5. Domain und SSL konfigurieren

### 5.1 Nginx-Konfiguration anpassen

Bearbeiten Sie die Datei `nginx.conf`:

```bash
nano nginx.conf
```

Ändern Sie den `server_name` in der Konfiguration zu Ihrer Domain (z.B. `server_name example.com www.example.com;`).

### 5.2 Let's Encrypt Zertifikate erstellen

```bash
# Starten Sie zunächst nur den Web-Server
sudo docker-compose up -d app

# Warten Sie einen Moment, bis der Server aktiv ist
sleep 5

# Führen Sie certbot aus (ersetzen Sie example.com mit Ihrer Domain)
sudo docker-compose run --rm certbot certonly --webroot --webroot-path=/var/www/certbot -d example.com -d www.example.com
```

### 5.3 HTTPS-Konfiguration aktivieren

Nachdem die Zertifikate erfolgreich erstellt wurden, bearbeiten Sie `nginx.conf` erneut und entfernen Sie die Kommentarzeichen (#) vom HTTPS-Server-Block:

```bash
nano nginx.conf
```

Entfernen Sie `#` von allen Zeilen im HTTPS-Server-Block und stellen Sie sicher, dass die Domaineinstellung korrekt ist.

## 6. Anwendung starten

```bash
# Docker-Container starten
sudo docker-compose down
sudo docker-compose up -d
```

## 7. Überprüfen der Installation

Nach dem Start sollte die Anwendung unter Ihrer Domain über HTTPS erreichbar sein. Der Admin-Benutzer wurde automatisch angelegt mit der E-Mail-Adresse und dem Passwort, die Sie in der `docker-compose.yml` konfiguriert haben.

## 8. Zertifikatserneuerung automatisieren

Let's Encrypt-Zertifikate sind 90 Tage gültig und müssen dann erneuert werden. Richten Sie einen Cron-Job ein, der dies automatisch erledigt:

```bash
sudo crontab -e
```

Fügen Sie folgende Zeile hinzu:

```
0 3 * * * cd /pfad/zu/dronenglb && docker-compose run --rm certbot renew --quiet && docker-compose exec app nginx -s reload
```

Dies führt die Erneuerung täglich um 3 Uhr morgens durch und lädt Nginx neu, wenn Zertifikate erneuert wurden.

## 9. Sicherheitseinstellungen

Für zusätzliche Sicherheit empfehlen wir:

1. Eine Firewall zu konfigurieren:
```bash
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

2. SSH-Zugriff sichern:
```bash
sudo nano /etc/ssh/sshd_config
```
- Ändern Sie `PasswordAuthentication` zu `no`
- Setzen Sie `PermitRootLogin` auf `no`
- Konfigurieren Sie `AllowUsers` für spezifische Benutzer

Dann SSH-Dienst neu starten:
```bash
sudo systemctl restart sshd
```

## 10. Backup-Strategie

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

Sie können diese Befehle auch in ein Skript packen und über cron automatisch regelmäßig ausführen lassen.

## 11. Fehlerbehebung

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

### Komplett neu starten
```bash
sudo docker-compose down
sudo docker-compose up -d
```

## 12. Updates installieren

Um die Anwendung zu aktualisieren:

```bash
cd /pfad/zu/dronenglb
git pull
sudo docker-compose down
sudo docker-compose build
sudo docker-compose up -d
```

Bei Fragen oder Problemen erstellen Sie bitte ein Issue im GitHub-Repository.
