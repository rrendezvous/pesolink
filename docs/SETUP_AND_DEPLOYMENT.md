# PESO-Link MisOr: Setup and Deployment Guide

This guide is for IT staff or developers. It explains how to:

1. [Run the system on your own computer](#1-run-the-system-on-your-own-computer) (for development and demos)
2. [Put the server online](#2-put-the-server-online) on a cloud virtual machine
3. [Build the Android app (APK)](#3-build-the-android-app-apk) that connects to that server
4. [Publish the app on Google Play](#4-publish-the-app-on-google-play) (optional, for public release)
5. [Update, back up, and move the server](#5-update-back-up-and-move-the-server)
6. [Troubleshooting](#6-troubleshooting)

**Important:** the app always needs the server online. Google Play only changes how people install the app (from the Play Store instead of an APK file); accounts, profiles, jobs, scans, and alerts are all stored on the server.

Users (job seekers, employers, and PESO staff) do not need this guide. They use the [User Manual](user-manual/README.md).

## How the parts fit together

```text
Android app (APK)  --internet (HTTPS)-->  nginx  -->  Node.js backend  -->  MySQL database
                                                          |
                                                          +-->  OCR helper (PaddleOCR), on the same server
```

- The **Android app** shows the screens. It has the server address built in when the APK is made.
- The **backend** (Node.js, Express) handles accounts, profiles, jobs, applications, alerts, and the form scan (Tesseract.js).
- The **OCR helper** (PaddleOCR) is an optional second reader for handwritten answers. It runs on the same server, so form photos are not sent to outside services.
- **MySQL** stores all data, including the uploaded form photos.
- **nginx** receives the app's requests over HTTPS and passes them to the backend.

Words used here:

| Word | Meaning |
|---|---|
| Server / VM | The computer that runs the backend online. A VM (virtual machine) is a server rented from a cloud provider such as Microsoft Azure. |
| Terminal | The window where you type commands. On the server you reach it with SSH. |
| SSH | A safe way to open the server's terminal from your own computer |
| `sudo` | Put in front of a command to run it as the server's administrator. It may ask for your password. |
| `nano` | A simple text editor in the terminal (see below) |
| Placeholders in CAPITALS | Replace them with your own values: `YOUR_DOMAIN` = your server's web address (for example `pesolink.example.com`), `YOUR_DB_PASSWORD` = a strong password you choose, `USERNAME` = your user name on the server |

### How to use the commands in this guide

- Copy **one grey box at a time**, paste it into the terminal, and press **Enter**. Wait until it finishes before the next box.
- Lines starting with `#` are only notes; they do nothing.
- If a command prints **error** or **failed**, stop and read the message before going on. See [6. Troubleshooting](#6-troubleshooting).
- **Using `nano`:** after `nano FILE`, paste or type the text, then press **Ctrl+O** and **Enter** to save, and **Ctrl+X** to close.
- To paste in the terminal, right-click (Windows) or press **Ctrl+Shift+V** (Linux).

---

## 1. Run the system on your own computer

The full steps (Windows) are in the project [README](../README.md#backend-setup). In short:

1. Install **Node.js** (LTS), **MySQL**, and **Git**.
2. `cd backend`, `npm install`, create `backend/.env` (see the README), then `npm run reset-demo` to create a demo database with sample accounts.
3. `npm start` and open `http://localhost:8001/api/health` to check it works.
4. `cd frontend`, `npm install`, then start Expo and open the app in **Expo Go** or the Android emulator (see the README).
5. Optional: set up the OCR helper with `npm run ocr:setup` in `backend` (see [OCR_SETUP.md](OCR_SETUP.md)).

Never run `npm run init-db` on a database you need: it deletes the tables of `peso_link_misor`.

---

## 2. Put the server online

These are the steps used for the evaluation server: **Ubuntu 24.04** on a Microsoft Azure VM with 2 vCPUs and 8 GB of memory (size Standard_B2as_v2). **Any provider with an Ubuntu 24.04 server works the same way** (another cloud provider, or a server PESO already uses); only step 2.1 depends on the provider.

Use a web address that the server owner controls for the long term (for example a domain owned by PESO). The address is built into the app, so changing it later means releasing a new app version.

### 2.1 Create the virtual machine

In your cloud provider's portal:

1. Create a VM with **Ubuntu Server 24.04 LTS** (x64). 2 vCPUs and 8 GB of memory are enough for small tests with the form scan.
2. Choose **SSH public key** sign-in and keep the private key file safe.
3. Allow incoming ports **22** (SSH), **80** (HTTP), and **443** (HTTPS).
4. Give the VM a fixed web address: on Azure, set a **DNS name label** on its public IP (this gives an address like `NAME.REGION.cloudapp.azure.com`), or point your own domain to the VM's public IP.

Connect from your computer. On Windows, open **PowerShell** (it already has `ssh`) and type:

```bash
ssh -i PATH_TO_YOUR_KEY USERNAME@YOUR_DOMAIN
```

- `PATH_TO_YOUR_KEY` is the private key file you downloaded or created, for example `C:\Users\you\.ssh\pesolink-key.pem`.
- The first time, it asks whether to trust the server: type **yes**.
- When the prompt changes to something like `USERNAME@vm-name:~$`, you are typing on the server. Run all commands in section 2 there.

### 2.2 Prepare the server

Questions you may see here:
- During `apt upgrade`, a purple screen may ask which services to restart: press **Enter** to accept.
- `ufw enable` warns that it may disrupt SSH and asks `Proceed with operation (y|n)?`: type **y**. (SSH is allowed in the line before it, so you stay connected.)

```bash
sudo apt update && sudo apt upgrade -y

# 2 GB swap file (extra memory for busy moments)
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Firewall: only SSH and web traffic
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# Blocks repeated wrong SSH logins
sudo apt install -y fail2ban
```

### 2.3 Install the software

```bash
# Node.js 22 (from NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# MySQL, nginx, Git, HTTPS certificates, and Python for the OCR helper
sudo apt install -y mysql-server nginx git certbot python3-certbot-nginx python3-venv

# Libraries the OCR helper (PaddleOCR) needs
sudo apt install -y libgl1 libglib2.0-0t64
```

### 2.4 Set up MySQL

```bash
sudo mysql
```

The prompt changes to `mysql>`. You are now typing to MySQL. Paste these lines to create the app's database user (the database itself is created in step 2.5); `EXIT;` brings you back to the normal prompt:

```sql
CREATE USER 'pesolink'@'localhost' IDENTIFIED BY 'YOUR_DB_PASSWORD';
GRANT ALL PRIVILEGES ON `peso\_link\_%`.* TO 'pesolink'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Form photos are stored in the database, so MySQL must accept large requests:

```bash
printf '[mysqld]\nmax_allowed_packet = 32M\n' | sudo tee /etc/mysql/mysql.conf.d/pesolink.cnf
sudo systemctl restart mysql
```

MySQL only listens on the server itself (`bind-address = 127.0.0.1`, the Ubuntu default). Keep it that way.

### 2.5 Install the app

```bash
sudo mkdir -p /opt/pesolink && sudo chown $USER /opt/pesolink
git clone https://github.com/rrendezvous/pesolink.git /opt/pesolink/app
cd /opt/pesolink/app/backend
npm install
```

First make a long random secret (used to protect sign-ins) and copy what it prints:

```bash
openssl rand -hex 48
```

Then create the settings file `backend/.env`:

```bash
nano .env
```

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=pesolink
DB_PASSWORD=YOUR_DB_PASSWORD
DB_NAME=peso_link_cloud
PORT=8001
JWT_SECRET=PASTE_A_LONG_RANDOM_SECRET
JWT_EXPIRES_IN=7d
OCR_HELPER_URL=http://127.0.0.1:8765
MIN_SKILL_MATCHES=0
```

- Paste the secret you copied as `JWT_SECRET`. Never reuse the example secret from the README.
- Use the same `YOUR_DB_PASSWORD` as in step 2.4.
- If you will skip the OCR helper (step 2.6), leave out the `OCR_HELPER_URL` line.
- `MIN_SKILL_MATCHES` is the minimum number of a job's required skills a job seeker must have to apply (the code default is 3; `0` turns it off).
- Protect the file: `chmod 600 .env`

Create the database (tables, the 67-skill list, and sample accounts):

```bash
DB_HOST=127.0.0.1 DEMO_DB=peso_link_cloud npm run reset-demo
```

The sample accounts (listed under "Demo Accounts" in the [README](../README.md#demo-accounts)) use known demo passwords. **Before real use**, see [Real PESO Admin and sample accounts](#real-peso-admin-and-sample-accounts) in section 5.

### 2.6 Set up the OCR helper (optional, recommended)

```bash
cd /opt/pesolink/app/backend
npm run ocr:setup
```

This makes `backend/ocr-helper/.venv` and installs PaddleOCR (it downloads a lot; it can take several minutes). Without the helper, the form scan still works with Tesseract.js only, with lower accuracy on handwriting.

### 2.7 Run the backend and OCR helper as services

Services start automatically when the server starts and restart if they stop. Replace `USERNAME` with your server user name (type `whoami` to see it). If you skipped the OCR helper (step 2.6), skip the first file and leave `pesolink-ocr` out of the commands below.

```bash
sudo nano /etc/systemd/system/pesolink-ocr.service
```

```ini
[Unit]
Description=PESO-Link OCR helper (PaddleOCR)
After=network.target
[Service]
User=USERNAME
WorkingDirectory=/opt/pesolink/app/backend/ocr-helper
Environment=OCR_HELPER_THREADS=2
ExecStart=/opt/pesolink/app/backend/ocr-helper/.venv/bin/python server.py
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
```

```bash
sudo nano /etc/systemd/system/pesolink-api.service
```

```ini
[Unit]
Description=PESO-Link MisOr backend
After=network.target mysql.service pesolink-ocr.service
Wants=mysql.service
[Service]
User=USERNAME
WorkingDirectory=/opt/pesolink/app/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
```

Start them:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pesolink-ocr pesolink-api
systemctl is-active pesolink-ocr pesolink-api      # both should say "active"
curl http://localhost:8001/api/health              # should answer {"status":"ok",...}
```

To read their logs: `sudo journalctl -u pesolink-api -n 50` (or `-u pesolink-ocr`). The first start of the OCR helper can take a minute or two while it loads its reading model; scans still work meanwhile (with Tesseract.js only).

### 2.8 Put nginx in front, with HTTPS

```bash
sudo nano /etc/nginx/sites-available/pesolink
```

```nginx
server {
    server_name YOUR_DOMAIN;
    # photos are sent as text (base64); the backend accepts up to 15 MB, so allow a little more here
    client_max_body_size 20m;
    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # scanning a form can take a while on a busy server
        proxy_read_timeout 240s;
        proxy_send_timeout 240s;
    }
    listen 80;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/pesolink /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# Free HTTPS certificate from Let's Encrypt; also sends http:// visitors to https://
sudo certbot --nginx -d YOUR_DOMAIN
```

`certbot` asks for an email address (for renewal notices) and to accept the terms; answer the questions. The domain must already point to this server, or it fails.

The certificate renews by itself. Check from any browser: `https://YOUR_DOMAIN/api/health` should show `{"status":"ok", ...}`.

### 2.9 Automatic backups

Create `/opt/pesolink/backup.sh`:

```bash
sudo nano /opt/pesolink/backup.sh
```

```sh
#!/bin/sh
# Dumps the database the app is using (DB_NAME in backend/.env), keeping the newest 14 copies.
set -eu
DIR=/opt/pesolink/backups/auto
mkdir -p "$DIR"
DB=$(grep "^DB_NAME=" /opt/pesolink/app/backend/.env | cut -d= -f2)
OUT="$DIR/$DB-$(date -u +%Y%m%d-%H%M)UTC.sql.gz"
mysqldump --single-transaction --quick "$DB" | gzip > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"
chmod 600 "$OUT"
ls -1t "$DIR/$DB"-*.sql.gz | tail -n +15 | xargs -r rm -f
echo "$(date -u +%FT%TZ) backup ok $(basename "$OUT")" >> /var/log/pesolink-backup.log
```

```bash
sudo chmod 755 /opt/pesolink/backup.sh
# twice a day: 6:00 AM and 11:00 PM Philippine time (22:00 and 15:00 UTC)
echo '0 22,15 * * * root /opt/pesolink/backup.sh >> /var/log/pesolink-backup.log 2>&1' | sudo tee /etc/cron.d/pesolink-backup
sudo /opt/pesolink/backup.sh && sudo tail -1 /var/log/pesolink-backup.log
```

Also copy the backups to another computer from time to time, so they survive if the VM is deleted. The backup files can only be read by the administrator, so first copy the newest one to your home folder on the server:

```bash
cp_latest=$(sudo ls -1t /opt/pesolink/backups/auto/*.sql.gz | head -1)
sudo cp "$cp_latest" ~/ && sudo chown $USER ~/$(basename "$cp_latest") && ls ~/*.sql.gz
```

Then, on **your own computer** (PowerShell), download it:

```bash
scp -i PATH_TO_YOUR_KEY USERNAME@YOUR_DOMAIN:~/BACKUP_FILE_NAME.sql.gz .
```

Afterwards, delete the copy in your home folder on the server (`rm ~/BACKUP_FILE_NAME.sql.gz`).

---

## 3. Build the Android app (APK)

The APK contains the server address, so build it **after** the server has its final address. These steps are for Windows.

**You need (install these first):**
- **Node.js** (LTS) from https://nodejs.org
- **Java 17** (JDK 17), for example Eclipse Temurin 17 from https://adoptium.net. Newer Java versions (including the one inside Android Studio) fail with this project.
- **Android Studio** from https://developer.android.com/studio. Open it once and finish the **Setup Wizard** with the standard options; it installs the **Android SDK** (by default in `C:\Users\YOUR_WINDOWS_NAME\AppData\Local\Android\Sdk`).

Use **Command Prompt** (cmd) for these steps.

1. Copy the `frontend` folder to a **short path** (Windows has a 260-character path limit that breaks the Android build in deep folders). First go to the project folder (the one that contains `frontend` and `backend`), then copy:

   ```cmd
   cd PATH_TO_THE_PROJECT_FOLDER
   robocopy frontend C:\plb /E /XD node_modules android
   ```

   robocopy prints a summary table at the end; that is normal.

2. Install the packages and make the Android project with your server address:

   ```cmd
   cd C:\plb
   npm install
   set EXPO_PUBLIC_BACKEND_URL=https://YOUR_DOMAIN
   npx expo prebuild --platform android
   ```

3. Build the APK with Java 17. Replace the two paths with where Java 17 and the Android SDK are on your computer. (To find the Java folder, open `C:\Program Files\Eclipse Adoptium` in File Explorer and use the full name of the `jdk-17...` folder inside.)

   ```cmd
   cd android
   set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.x-hotspot
   set ANDROID_HOME=C:\Users\YOUR_WINDOWS_NAME\AppData\Local\Android\Sdk
   set EXPO_PUBLIC_BACKEND_URL=https://YOUR_DOMAIN
   gradlew assembleRelease "-PreactNativeArchitectures=arm64-v8a,x86_64"
   ```

   The first build downloads a lot and can take 10 to 20 minutes. It is done when it prints **BUILD SUCCESSFUL**.

4. The APK is at `C:\plb\android\app\build\outputs\apk\release\app-release.apk`. Rename it (for example `PESO-Link-MisOr.apk`) and share it.

- `arm64-v8a` is for phones; `x86_64` lets it run on the Android emulator.
- If the server address changes, build a new APK; old copies keep calling the old address.
- The build above is signed with the default test (debug) key, which is fine for testing. For a real release, create your own signing key and keep it safe; updates must be signed with the same key.

Check the APK on a phone or the emulator: sign in, open Jobs, and try one form scan.

---

## 4. Publish the app on Google Play

Google Play lets people install and update the app from the Play Store. This is optional; the APK in section 3 works without it. Google's rules change over time, so follow the current instructions in the **Google Play Console** help pages; this section lists what this project needs.

### 4.1 Before you start

- A **Google Play developer account** for the organization that will own the app (for example PESO), with the one-time registration fee and identity verification that Google asks for.
- The **final server address** (section 2), already online with HTTPS.
- A **privacy policy** web page that explains what the app collects (NSRP profile details, contact details, uploaded form photos), why, who can see it, and how long it is kept. Google requires its link. The data is personal information under the Data Privacy Act of 2012 (RA 10173), so PESO should review it.
- The **app name, icon, screenshots, and a short description** for the store listing. The screenshots in the [User Manual](user-manual/README.md) can be used.

### 4.2 Choose the app ID and signing key (do this once)

- The **app ID** (package name) is set in `frontend/app.json` as `android.package` (currently `com.pesolinkhq.misor`). It cannot be changed after the first upload, so decide the final one first (for example one that names PESO).
- Google Play needs your **own upload key** (not the default debug key used for testing). Create it once and keep the file and its password in a safe place (never on GitHub): every future update must be signed with it.

  Do the steps in this section **after** running `npx expo prebuild` (section 3, step 2), because prebuild recreates the `android` folder and removes these changes. If you run prebuild again later, redo steps 2 and 3 below.

  1. Make the key (it asks for a password and your organization's details):

     ```cmd
     cd C:\plb\android\app
     "%JAVA_HOME%\bin\keytool" -genkeypair -v -keystore pesolink-upload.keystore -alias pesolink -keyalg RSA -keysize 2048 -validity 10000
     ```

     (`JAVA_HOME` must be set as in section 3, step 3.)

  2. Open `C:\plb\android\gradle.properties` in Notepad and add these lines at the end (use your key password):

     ```properties
     PESOLINK_UPLOAD_STORE_FILE=pesolink-upload.keystore
     PESOLINK_UPLOAD_KEY_ALIAS=pesolink
     PESOLINK_UPLOAD_STORE_PASSWORD=YOUR_KEY_PASSWORD
     PESOLINK_UPLOAD_KEY_PASSWORD=YOUR_KEY_PASSWORD
     ```

  3. Open `C:\plb\android\app\build.gradle` in Notepad. Inside `signingConfigs { ... }`, add a `release` block next to `debug`:

     ```groovy
     release {
         storeFile file(PESOLINK_UPLOAD_STORE_FILE)
         storePassword PESOLINK_UPLOAD_STORE_PASSWORD
         keyAlias PESOLINK_UPLOAD_KEY_ALIAS
         keyPassword PESOLINK_UPLOAD_KEY_PASSWORD
     }
     ```

     Then, inside `buildTypes { release { ... } }`, change `signingConfig signingConfigs.debug` to `signingConfig signingConfigs.release`.

### 4.3 Build the Play Store file (AAB)

Google Play takes an **Android App Bundle** (`.aab`), not an APK. Follow section 3, steps 1 to 3, but run this instead of `assembleRelease`:

```cmd
gradlew bundleRelease
```

The file is at `C:\plb\android\app\build\outputs\bundle\release\app-release.aab`.

**For each new version**, Google Play needs a higher version number. Before building, open `frontend/app.json` and:
- raise `"version"` (for example from `"1.0.0"` to `"1.0.1"`), and
- inside `"android"`, add or raise `"versionCode"` (for example `"versionCode": 2`, then 3, and so on).

Then copy the folder again and redo section 3, steps 1 to 3, and section 4.2 steps 2 and 3, before running `bundleRelease`.

### 4.4 Upload and release

In the Google Play Console:

1. Create the app and fill in the store listing (name, description, icon, screenshots, privacy policy link).
2. Complete the **App content** forms: data safety (what data is collected and why), target audience, and content rating. The app uses the **camera** and the **photo picker** only for scanning the NSRP form.
3. Upload the `.aab` to a **testing track** first. New developer accounts may have to run a closed test with a minimum number of testers for some days before they can publish to everyone; the Console shows the current requirement.
4. When testing is done, release it to **Production**. Google reviews the app before it appears in the Play Store.

---

## 5. Update, back up, and move the server

### Update the app on the server

```bash
cd /opt/pesolink/app
git pull
cd backend && npm install
sudo systemctl restart pesolink-api
curl http://localhost:8001/api/health
```

If the change is in the `frontend` (the screens), also build and share a new APK (or upload a new version to Google Play, section 4).

### Restore a backup

```bash
sudo mysql -e "CREATE DATABASE DATABASE_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
gunzip -c BACKUP_FILE.sql.gz | sudo mysql DATABASE_NAME
```

Use a database name starting with `peso_link_` so the app's MySQL user can use it.

Restore into a new, empty database first and check it before switching the app to it (change `DB_NAME` in `backend/.env` and restart `pesolink-api`).

### Move to a new server

1. Make a fresh backup on the old server and copy it to your computer.
2. Set up the new server with sections 2.1 to 2.9 (skip `reset-demo` if you restore a backup).
3. Restore the backup into a database with the same name as `DB_NAME`.
4. If the web address stays the same (your own domain pointed to the new server), the existing app keeps working. If the address changes, build and share a new APK (section 3) or a new Google Play version (section 4).

### Real PESO Admin and sample accounts

The app has no screen for changing passwords or adding PESO Admin accounts, so these are done on the server. Work in the `backend` folder:

```bash
cd /opt/pesolink/app/backend
# Make a password hash (replace NEW_PASSWORD); copy the line it prints (starts with $2)
node -e "require('bcryptjs').hash(process.argv[1], 10).then(console.log)" 'NEW_PASSWORD'
sudo mysql peso_link_cloud
```

At the `mysql>` prompt (replace the values; keep the quotes):

```sql
-- Add a real PESO Admin account
INSERT INTO users (email, password_hash, role, account_status)
VALUES ('admin.email@example.gov.ph', 'PASTE_THE_HASH', 'admin', 'active');

-- Or change the password of an existing account (for example the sample admin)
UPDATE users SET password_hash = 'PASTE_THE_HASH' WHERE email = 'admin@peso.gov.ph';
EXIT;
```

For the sample job seeker and employer accounts, sign in as PESO Admin and **deactivate** them in the app (NSRP tab and Employers), or change their passwords the same way.

### Before real use (not only testing)

- Use a new, random `JWT_SECRET` and strong database and admin passwords.
- Change or remove the sample accounts.
- Keep the OS updated (`sudo apt update && sudo apt upgrade`) and keep backups off the server.
- Review who can sign in to the server over SSH.

---

## 6. Troubleshooting

| Problem | What to check |
|---|---|
| `https://YOUR_DOMAIN/api/health` does not open | Is the VM running, and are ports 80 and 443 open in the provider's portal? Does the domain point to the VM? Run `sudo nginx -t` and `systemctl is-active nginx`. |
| The browser shows **502 Bad Gateway** | nginx works but the backend is not running. Run `systemctl is-active pesolink-api` and read `sudo journalctl -u pesolink-api -n 50`. |
| The backend log says it cannot connect to MySQL | Check `DB_USER`, `DB_PASSWORD`, and `DB_NAME` in `backend/.env`, and that MySQL runs: `systemctl is-active mysql`. |
| The app says "Network error" or "Backend could not be reached" | The phone cannot reach the server: check its internet, the health address above, and that the APK was built with the right `EXPO_PUBLIC_BACKEND_URL`. |
| Uploading a form photo fails ("too large") | Check `client_max_body_size 20m` in the nginx site and `max_allowed_packet = 32M` in MySQL (sections 2.4 and 2.8). |
| Scans work but handwriting reads poorly | Is the OCR helper running? `systemctl is-active pesolink-ocr`, and `OCR_HELPER_URL=http://127.0.0.1:8765` in `backend/.env`. |
| After changing `backend/.env`, nothing changed | Restart the backend: `sudo systemctl restart pesolink-api`. |
| The APK build fails with a Java error | Make sure `JAVA_HOME` points to **Java 17**, not a newer version. |
| The APK build fails with "SDK location not found" | Set `ANDROID_HOME` to the Android SDK folder (section 3, step 3). |
| The APK build fails with a path or "filename too long" error | Build from a short folder such as `C:\plb` (section 3, step 1). |
