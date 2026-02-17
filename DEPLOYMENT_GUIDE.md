# 🚀 Signaling Server Deployment - Quick Start Guide

## What You Just Created

Your Islamic Cooperative Meeting app now has:
- ✅ **Standalone signaling server** ready for deployment
- ✅ **Admin settings page** to configure server URL  
- ✅ **Configurable connections** - switch between local and remote servers

---

## 📁 Files Created

```
signaling-server/
├── server.js              # Main server code
├── package.json           # Dependencies
├── ecosystem.config.js    # PM2 configuration
├── .env.example          # Configuration template
├── .gitignore            # Git ignore rules
└── README.md             # Full deployment guide
```

---

## 🎯 Quick Deployment to Oracle Cloud (Free Forever)

### Step 1: Sign Up for Oracle Cloud
1. Go to https://www.oracle.com/cloud/free/
2. Click "Start for free" → Create account
3. **No credit card required initially**
4. Verify email and complete registration

### Step 2: Create VM Instance
1. Login to Oracle Cloud Console
2. Click **"Create a VM Instance"**
3. Settings:
   - **Name**: `meeting-signal-server`
   - **Image**: Ubuntu 22.04
   - **Shape**: VM.Standard.E2.1.Micro (Always Free)
   - **Boot Volume**: 50 GB
4. **Download SSH private key** (save as `oracle-key.pem`)
5. Click **"Create"**
6. Wait 2 minutes for provisioning
7. **Copy Public IP address** (e.g., `123.45.67.89`)

### Step 3: Configure Firewall
1. In VM details → Click **"Subnet"**
2. Click your **Security List**
3. Click **"Add Ingress Rules"**
4. Add these 3 rules:

| Source CIDR | Destination Port | Description |
|-------------|------------------|-------------|
| 0.0.0.0/0   | 3001            | Signaling Server |
| 0.0.0.0/0   | 80              | HTTP |
| 0.0.0.0/0   | 443             | HTTPS |

### Step 4: Connect to VM

**Windows PowerShell:**
```powershell
# Fix key permissions first
icacls C:\path\to\oracle-key.pem /inheritance:r
icacls C:\path\to\oracle-key.pem /grant:r "%username%:R"

# Connect
ssh -i C:\path\to\oracle-key.pem ubuntu@YOUR_VM_IP
```

### Step 5: Install Node.js & PM2
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2

# Verify installations
node --version  # Should show v20.x.x
pm2 --version   # Should show version number
```

### Step 6: Upload Server Files

**Option A - Using SCP (from your PC):**
```powershell
# Navigate to your app folder
cd C:\xamps\htdocs\amrimeetingapp

# Upload signaling-server folder
scp -i C:\path\to\oracle-key.pem -r signaling-server ubuntu@YOUR_VM_IP:~/
```

**Option B - Manual Creation (on VM):**
```bash
mkdir ~/signaling-server
cd ~/signaling-server
nano server.js
# Copy-paste content from signaling-server/server.js
# Press Ctrl+X, then Y to save

nano package.json
# Copy-paste content from signaling-server/package.json
# Save and exit

# Repeat for ecosystem.config.js
```

### Step 7: Configure Server
```bash
cd ~/signaling-server

# Create .env file
nano .env
```

Add this content:
```env
PORT=3001
CORS_ORIGIN=*
AUTH_TOKEN=
```

**Save with Ctrl+X → Y**

### Step 8: Install & Start Server
```bash
# Install dependencies
npm install --production

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 list
pm2 save

# Auto-start on reboot
pm2 startup
# Copy and run the command that PM2 outputs

# Check status
pm2 status
pm2 logs
```

### Step 9: Open Ubuntu Firewall
```bash
# Allow port 3001
sudo ufw allow 3001/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow OpenSSH

# Enable firewall
sudo ufw enable
# Press Y to confirm
```

### Step 10: Test Server
```bash
# Test from VM
curl http://localhost:3001/health

# Should return:
# {"status":"healthy","timestamp":"...","activeRooms":0,"uptime":...}
```

**Test from your PC:**
```powershell
# Replace with your actual VM IP
curl http://YOUR_VM_IP:3001/health
```

---

## 🎮 Configure Your App

### Step 1: Open Settings in App
1. Launch your Islamic Meeting app
2. Login as **admin** (email: `admin@cooperative.local`, password: `admin123`)
3. Click **"Settings"** in sidebar

### Step 2: Update Server URL
1. In "Signaling Server URL" field, enter:
   ```
   http://YOUR_VM_IP:3001
   ```
   Replace `YOUR_VM_IP` with actual IP (e.g., `http://123.45.67.89:3001`)

2. Click **"Test Connection"** 
   - Should show ✅ Connection successful!

3. Click **"Save Settings"**

4. **Restart the app**

### Step 3: Test Meeting
1. Create a new meeting
2. Join the meeting
3. Connection status should show "Connected"
4. ✅ You're done!

---

## 🔒 Optional: Setup HTTPS with Domain

### Benefits
- ✅ Secure WSS connections
- ✅ Professional domain name
- ✅ Better for production use

### Requirements
- Domain name (e.g., from Cloudflare, Namecheap - $10-15/year)
- Point domain to your VM IP

### Setup Steps

1. **Point Domain to VM:**
   - Login to your domain provider
   - Create A record: `signal.yourdomain.com` → `YOUR_VM_IP`
   - Wait 5-10 minutes for DNS propagation

2. **Install Nginx & Certbot:**
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

3. **Create Nginx Config:**
```bash
sudo nano /etc/nginx/sites-available/signaling
```

Add this:
```nginx
server {
    listen 80;
    server_name signal.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

4. **Enable Site:**
```bash
sudo ln -s /etc/nginx/sites-available/signaling /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

5. **Get SSL Certificate:**
```bash
sudo certbot --nginx -d signal.yourdomain.com
# Follow prompts, enter your email
```

6. **Update App Settings:**
   - Open app Settings page
   - Set URL to: `https://signal.yourdomain.com`
   - Test & Save
   - Restart app

---

## 📊 Server Management

### Check Status
```bash
pm2 status
```

### View Logs
```bash
pm2 logs islamic-meeting-signal
pm2 logs --lines 100
```

### Restart Server
```bash
pm2 restart islamic-meeting-signal
```

### Monitor Resources
```bash
pm2 monit
htop  # Install: sudo apt install htop
```

### Update Server Code
```bash
cd ~/signaling-server
# Upload new server.js if changed
pm2 restart islamic-meeting-signal
```

---

## 🆘 Troubleshooting

### Can't connect from app
1. **Check VM is running** (Oracle Cloud Console)
2. **Check PM2 status**: `pm2 status`
3. **Check firewall rules** (both Oracle Cloud Security List AND Ubuntu UFW)
4. **Test from VM**: `curl http://localhost:3001/health`
5. **Test from PC**: `curl http://YOUR_VM_IP:3001/health`

### Port already in use
```bash
sudo lsof -i :3001
sudo kill -9 PID  # Replace PID with process ID
pm2 restart islamic-meeting-signal
```

### VM not responding
- Oracle may reclaim idle VMs
- Login to Oracle Cloud Console
- Stop and Start the VM
- Reconnect with SSH

### Certificate renewal (if using HTTPS)
```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot auto-renews every 60 days
# Check cron: sudo systemctl status certbot.timer
```

---

## 💰 Costs

### Oracle Cloud Always Free
- ✅ **FREE FOREVER** - No expiration
- ✅ 2 VMs (1GB RAM each)
- ✅ 200 GB bandwidth/month
- ✅ 100 GB storage
- ✅ No automatic charges

### Optional Costs
- Domain name: ~$10-15/year
- Nothing else required!

---

## 📚 Additional Resources

- **Full Documentation**: See `signaling-server/README.md`
- **Oracle Cloud Docs**: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm
- **PM2 Docs**: https://pm2.keymetrics.io/docs/usage/quick-start/
- **Let's Encrypt**: https://letsencrypt.org/

---

## ✅ Success Checklist

- [ ] Oracle Cloud account created
- [ ] VM instance running
- [ ] Firewall ports opened (3001, 80, 443)
- [ ] Node.js & PM2 installed
- [ ] Server files uploaded
- [ ] PM2 running server
- [ ] Health check working from VM
- [ ] Health check working from PC
- [ ] App settings updated with VM IP
- [ ] Test meeting successful
- [ ] (Optional) Domain configured
- [ ] (Optional) HTTPS enabled

---

**🎉 Congratulations!** 

Your signaling server is now deployed and your meeting app can connect users across the internet!

All users must configure the same server URL in their app settings.
