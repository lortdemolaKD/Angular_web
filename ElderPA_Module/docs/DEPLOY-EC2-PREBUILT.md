# Deploy to EC2 Without Building on the Server

If the Angular build hangs or runs out of memory on EC2, build the app **on your PC** and deploy so EC2 only runs the pre-built app.

---

## Step 1: Build on your PC

In the project folder (PowerShell or Command Prompt):

```powershell
cd F:\After-25-06-2025\projects\ElderPAModule_VerDB\ElderPA_Module
npm run build
```

When it finishes, you should have `dist\ElderPA_Module\` with `browser\` and `server\` inside.

---

## Step 2: Zip the `dist` folder

On your PC, create a zip of the **dist** folder only (right‑click `dist` → Send to → Compressed folder, or):

```powershell
Compress-Archive -Path dist -DestinationPath dist.zip
```

---

## Step 3: Upload dist.zip to EC2

From your PC (replace with your EC2 IP):

```powershell
scp -i "C:\Users\kacpe\Downloads\VS-kp-1.pem" dist.zip ec2-user@13.51.176.168:~/
```

---

## Step 4: On EC2 – unzip and run with prebuilt app

SSH in, then:

```bash
cd ~/ElderPA_Module
unzip -o ~/dist.zip
```

Make sure `server/.env` exists (create it with `nano server/.env` if needed). Then start the stack using the **prebuilt** compose file (so the app image is built from `Dockerfile.prebuilt`, which only copies `dist`, no Angular build):

```bash
DOCKER_BUILDKIT=0 docker-compose -f docker-compose.yml -f docker-compose.ec2.yml -f docker-compose.prebuilt.yml up -d --build
```

- The **api** and **app** images will build; the app build is fast because it only copies your pre-built `dist/`.
- Then open **http://YOUR_EC2_IP** in the browser.

---

## Step 5: Later deploys

1. On PC: `npm run build` → zip `dist` → `scp dist.zip ec2-user@EC2_IP:~/`
2. On EC2: `cd ~/ElderPA_Module && unzip -o ~/dist.zip && DOCKER_BUILDKIT=0 docker-compose -f docker-compose.yml -f docker-compose.ec2.yml -f docker-compose.prebuilt.yml up -d --build`
