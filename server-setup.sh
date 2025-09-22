#!/bin/bash

# Server Setup Script for Tahoe Night Nurse
# This installs all required dependencies on a fresh Hetzner server

echo "🚀 Setting up Tahoe Night Nurse server..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js (using NodeSource repository for latest LTS)
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Git
echo "📦 Installing Git..."
sudo apt install -y git

# Install PM2 globally
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Install build essentials (needed for some npm packages)
echo "📦 Installing build essentials..."
sudo apt install -y build-essential

# Verify installations
echo "✅ Verifying installations..."
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo "Git version: $(git --version)"
echo "PM2 version: $(pm2 --version)"

# Set up PM2 to start on boot
echo "🔧 Setting up PM2 startup..."
pm2 startup
echo "⚠️  Please run the command shown above to complete PM2 startup setup"

echo "✅ Server setup complete!"
echo "📝 Next steps:"
echo "1. Run the PM2 startup command shown above"
echo "2. Your deployment should now work!"