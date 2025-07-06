import fs from 'fs/promises';
import path from 'path';

const LAST_SYNC_FILE = path.join('ics', 'last_sync.json');

// Load last sync timestamps
export async function loadLastSync() {
  try {
    const data = await fs.readFile(LAST_SYNC_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, return default structure
    return {
      "airbnb.ics": null,
      "booking.ics": null,
      "personal.ics": null,
      "last_updated": new Date().toISOString()
    };
  }
}

// Save last sync timestamps
export async function saveLastSync(syncData) {
  await fs.mkdir('ics', { recursive: true });
  syncData.last_updated = new Date().toISOString();
  await fs.writeFile(LAST_SYNC_FILE, JSON.stringify(syncData, null, 2), 'utf-8');
}

// Update timestamp for a specific file
export async function updateFileTimestamp(filename) {
  const syncData = await loadLastSync();
  syncData[filename] = new Date().toISOString();
  await saveLastSync(syncData);
  console.log(`📝 Updated last sync timestamp for ${filename}`);
}

// Check if cache is fresh based on last sync timestamp
export async function isCacheFreshFromSync(filename, maxMinutes = 60) {
  const syncData = await loadLastSync();
  const lastSync = syncData[filename];
  
  if (!lastSync) {
    console.log(`🆕 No previous sync found for ${filename}`);
    return false;
  }
  
  const now = new Date();
  const lastSyncDate = new Date(lastSync);
  const ageMinutes = (now - lastSyncDate) / (1000 * 60);
  
  const isFresh = ageMinutes < maxMinutes;
  console.log(`⏰ Cache age for ${filename}: ${Math.round(ageMinutes)} minutes (fresh: ${isFresh})`);
  
  return isFresh;
}

// Get cache age in minutes for a file
export async function getCacheAge(filename) {
  const syncData = await loadLastSync();
  const lastSync = syncData[filename];
  
  if (!lastSync) {
    return null;
  }
  
  const now = new Date();
  const lastSyncDate = new Date(lastSync);
  return (now - lastSyncDate) / (1000 * 60);
}

// Display current cache status for all files
export async function displayCacheStatus() {
  const syncData = await loadLastSync();
  console.log('\n📊 Current Cache Status:');
  console.log('========================');
  
  for (const [filename, timestamp] of Object.entries(syncData)) {
    if (filename === 'last_updated') continue;
    
    if (timestamp) {
      const age = await getCacheAge(filename);
      const status = age < 60 ? '🟢 Fresh' : '🟡 Stale';
      console.log(`${status} ${filename}: ${Math.round(age)} minutes ago`);
    } else {
      console.log(`🔴 ${filename}: Never synced`);
    }
  }
  console.log('========================\n');
} 