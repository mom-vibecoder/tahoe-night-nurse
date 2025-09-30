#!/bin/bash
# Run this script on your server to set up the systemd service

set -e

echo "Setting up Tahoe Night Nurse systemd service..."

# Stop any existing nohup processes
pkill -f "node server/index.js" || true

# Copy service file
cp tahoe-night-nurse.service /etc/systemd/system/

# Reload systemd
systemctl daemon-reload

# Enable service to start on boot
systemctl enable tahoe-night-nurse

# Start the service
systemctl start tahoe-night-nurse

# Check status
systemctl status tahoe-night-nurse

echo "✅ Service setup complete!"
echo "View logs with: journalctl -u tahoe-night-nurse -f"
