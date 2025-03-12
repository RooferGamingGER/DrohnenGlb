
# DrohnenGLB Docker Setup

Diese Anleitung hilft dir, die DrohnenGLB-Anwendung mit Docker auf einem Ubuntu-Server zu installieren und zu betreiben.

## Voraussetzungen

- Ubuntu Server (empfohlen: Ubuntu 20.04 LTS oder neuer)
- Docker installiert
- Docker Compose installiert
- Git installiert

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
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.3/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 4. Anwendung klonen und starten

```bash
git clone <repository-url> dronenglb
cd dronenglb

# Umgebungsvariablen anpassen (falls nötig)
# Sichere JWT_SECRET generieren und ersetzen
nano .env

# Docker Container starten
sudo docker-compose up -d
```

### 5. Ersteinrichtung

Nach dem ersten Start muss ein Administratorkonto erstellt werden. Führe dazu folgenden Befehl aus:

```bash
sudo docker-compose exec api node src/scripts/create-admin.js
```

Folge den Anweisungen, um den Admin-Benutzer zu erstellen.

## Anwendung aktualisieren

Um die Anwendung zu aktualisieren, führe folgende Befehle aus:

```bash
cd dronenglb
git pull
sudo docker-compose down
sudo docker-compose build
sudo docker-compose up -d
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

1. Ändere das JWT_SECRET in der .env-Datei auf einen sicheren Wert
2. Setze sichere Passwörter für die Datenbank
3. Konfiguriere eine Firewall und erlaube nur die benötigten Ports
4. Setze HTTPS mit Let's Encrypt auf

## Systemanforderungen

- Mindestens 2 GB RAM
- 20 GB freier Speicherplatz
- 2 CPU-Kerne empfohlen

Bei Fragen oder Problemen, bitte ein Issue im GitHub-Repository erstellen.
