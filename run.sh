#!/bin/bash

echo "🚀 Starting sync..."

# Ensure environment is loaded
if [ ! -f .env ]; then
  echo "❌ .env file not found. Please create it with your credentials."
  exit 1
fi

# Run the sync script
node /Users/sortino/Documents/reservation-sync/src/index.js