# Deploy ElderPA to AWS EC2

Run the app on a single EC2 instance using Docker. Optionally put nginx in front so you get one URL on port 80 (no `:4000` in the address).

**Quick start (after EC2 is up and Docker installed):**

```bash
git clone <YOUR_REPO> elderpa && cd elderpa
# Set server/.env (MONGODB_URI, JWT_SECRET, EMAIL_*, FRONTEND_URL)
docker compose -f docker-compose.yml -f docker-compose.ec2.yml up -d --build
# Open http://<EC2_PUBLIC_IP>
```

**Example: instance with public IP `51.21.199.187` (ec2-user, Amazon Linux)**  
Connect via **EC2 Instance Connect** in the AWS console, or: `ssh -i your-key.pem ec2-user@51.21.199.187`. After installing Docker (see §3), clone the repo, set `server/.env`, then run the compose command above. Open **http://51.21.199.187** in the browser. Ensure the instance security group allows **inbound TCP 80** (and 22 for SSH).

---

## 1. Prerequisites

- AWS account
- Domain name (optional; you can use the EC2 public IP)
- SSH key pair for EC2

## 2. Launch EC2 instance

1. In **AWS Console** → **EC2** → **Launch instance**:
   - **Name:** e.g. `elderpa-prod`
   - **AMI:** Ubuntu Server 22.04 LTS
   - **Instance type:** e.g. `t3.small` (or larger for production)
   - **Key pair:** Create or select one; download the `.pem` file
   - **Network:** Create/use a security group with:
     - **SSH (22)** from your IP
     - **HTTP (80)** from 0.0.0.0/0
     - **HTTPS (443)** from 0.0.0.0/0
   - **Storage:** 20 GB+ recommended

2. Launch and note the **public IP** (or use an Elastic IP).

## 3. Connect and install Docker

### Option 1: EC2 Instance Connect (browser)

In the EC2 console, select the instance → **Connect** → **EC2 Instance Connect** → **Connect**. A browser terminal opens as `ec2-user`.

### Option 2: SSH (from your machine)

```bash
# Replace with your key and IP
ssh -i your-key.pem ec2-user@51.21.199.187
```

Use **ec2-user** for Amazon Linux; use **ubuntu** for Ubuntu AMIs.

### Install Docker on the instance

**Amazon Linux 2 / 2023 (ec2-user):**

```bash
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user
# Install Docker Compose v2 plugin
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
# Or use: sudo yum install -y docker-compose-plugin   (if available)
```

Log out and back in (or run `newgrp docker`), then:

```bash
docker --version
docker-compose --version
# or: docker compose version
```

**Ubuntu (ubuntu user):**

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu
```

Log out and back in, then verify:

```bash
docker --version
docker compose version
```

## 4. Deploy the application

### Option A: Clone and run with Docker Compose (no nginx)

Use this if you’re fine with HTTP and accessing the app by port (e.g. `http://<EC2_IP>:4000`).

```bash
# Clone (or upload your code)
git clone <YOUR_REPO_URL> elderpa
cd elderpa

# Create project root .env for Docker (MONGODB_URI, JWT_SECRET; optional API_URL)
cp .env.example .env
nano .env   # set MONGODB_URI, JWT_SECRET

# Ensure server/.env exists (same as local: MONGODB_URI, JWT_SECRET, EMAIL_USER, EMAIL_PASS, FRONTEND_URL)
nano server/.env

# Build and run (app on 4000, API on 3000)
docker compose up -d --build
```

- **App:** `http://<EC2_PUBLIC_IP>:4000`
- **API:** `http://<EC2_PUBLIC_IP>:3000`

Set in `server/.env`:

- `FRONTEND_URL=http://<EC2_PUBLIC_IP>:4000` (for invite links)

Set in project root `.env` (or app container env):

- So the frontend knows the API URL: when using ports, the browser must reach the API. Either:
  - Expose API on 3000 and set `API_URL=http://<EC2_PUBLIC_IP>:3000` for the **app** service in `docker-compose.yml`, or
  - Use Option B (nginx) so the same origin serves both app and API.

### Option B: Run with nginx (single URL on port 80)

Use this to serve the app and API at **one URL** (e.g. `http://<EC2_IP>` or `http://yourdomain.com`) with nginx in front. No port in the URL.

1. **Create env and server/.env**

In project root:

```bash
cp .env.example .env
nano .env   # MONGODB_URI, JWT_SECRET if using project .env
```

Ensure `server/.env` has:

- `MONGODB_URI`, `JWT_SECRET`
- `EMAIL_USER`, `EMAIL_PASS` (for invite emails)
- `FRONTEND_URL=http://<EC2_PUBLIC_IP>` or `http://yourdomain.com` (for invite links)

2. **Run the EC2 stack (with nginx)**

```bash
cd elderpa
docker compose -f docker-compose.yml -f docker-compose.ec2.yml up -d --build
```

- **Nginx** listens on **80**. Open: `http://<EC2_PUBLIC_IP>` (or `http://yourdomain.com` after DNS).
- App and API are not exposed on the host; nginx proxies `/` to the app and `/api`, `/uploads` to the API. The frontend uses the same origin for API calls.

3. **DNS** (optional)

- Point your domain A record to the EC2 public IP, then use `http://yourdomain.com` and set `FRONTEND_URL` in `server/.env` to that URL.

4. **HTTPS (Let’s Encrypt)**

- On the EC2 host install certbot, get a cert for your domain, then add an nginx server block in `deploy/nginx.conf` for 443 with `ssl_certificate` / `ssl_certificate_key` and mount the cert path into the nginx container. Restart nginx.

## 5. Environment variables summary

| Variable          | Where           | Purpose |
|------------------|-----------------|--------|
| `MONGODB_URI`    | `server/.env`   | MongoDB connection string |
| `JWT_SECRET`     | `server/.env`   | Same secret used for existing users |
| `EMAIL_USER`     | `server/.env`   | Gmail (or SMTP) for invite emails |
| `EMAIL_PASS`     | `server/.env`   | Gmail App Password or SMTP password |
| `FRONTEND_URL`   | `server/.env`   | Base URL for invite links (e.g. `https://yourdomain.com`) |
| `API_URL`        | App container   | Only if frontend hits API on a different URL (e.g. port 3000); leave unset when using nginx same-origin |
| `DOMAIN`         | `docker-compose.ec2.yml` | Used by nginx server_name |

## 6. Useful commands

```bash
# Logs
docker compose logs -f app
docker compose logs -f api

# Restart after changing .env
docker compose up -d --build

# Stop
docker compose down
```

## 7. Security checklist

- Restrict SSH (22) to your IP in the security group.
- Use HTTPS in production (Let’s Encrypt + nginx).
- Use strong `JWT_SECRET` and keep `server/.env` and `.env` out of version control.
- Prefer MongoDB in a VPC or use MongoDB Atlas with IP allowlist and strong auth.
