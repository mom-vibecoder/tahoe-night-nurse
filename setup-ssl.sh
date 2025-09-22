#!/bin/bash

# SSL Setup Script for Tahoe Night Nurse
# Run this on your Hetzner server to set up HTTPS

echo "🔒 Setting up SSL for tahoenightnurse.com..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install required packages
echo "📦 Installing nginx and certbot..."
sudo apt install -y nginx certbot python3-certbot-nginx ufw

# Configure firewall
echo "🔥 Configuring firewall..."
sudo ufw allow 'Nginx Full'
sudo ufw allow ssh
sudo ufw --force enable

# Stop nginx temporarily for certbot
sudo systemctl stop nginx

# Get SSL certificate
echo "🔑 Obtaining SSL certificate..."
sudo certbot certonly --standalone \
    --email admin@tahoenightnurse.com \
    --agree-tos \
    --no-eff-email \
    -d tahoenightnurse.com \
    -d www.tahoenightnurse.com

# Copy nginx configuration
echo "⚙️ Setting up nginx configuration..."
sudo cp /root/tahoe-night-nurse/nginx.conf /etc/nginx/sites-available/tahoenightnurse.com

# Enable the site
sudo ln -sf /etc/nginx/sites-available/tahoenightnurse.com /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
echo "🧪 Testing nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration is valid"
    
    # Start nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
    
    # Set up auto-renewal
    echo "🔄 Setting up SSL certificate auto-renewal..."
    sudo crontab -l 2>/dev/null | grep -v certbot | sudo crontab -
    (sudo crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet --nginx") | sudo crontab -
    
    echo "✅ SSL setup complete!"
    echo "🌐 Your site should now be accessible at https://tahoenightnurse.com"
    echo "🔒 SSL certificate will auto-renew every 3 months"
    
    # Test the setup
    echo "🧪 Testing HTTPS..."
    curl -I https://tahoenightnurse.com || echo "⚠️ HTTPS test failed - please check your setup"
    
else
    echo "❌ Nginx configuration has errors. Please check the configuration file."
    exit 1
fi

echo "🎉 Setup complete! Your site is now secure."