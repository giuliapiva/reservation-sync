import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

const CACHE_DIR = 'ics';
const CACHE_FILE = path.join(CACHE_DIR, 'airbnb.ics');
const CACHE_MAX_AGE_MINUTES = 60;
const useCached = false;

async function isCacheFresh(filePath, maxMinutes) {
  try {
    const stats = await fs.stat(filePath);
    const now = new Date();
    const mtime = new Date(stats.mtime);
    const ageMinutes = (now - mtime) / (1000 * 60);
    return ageMinutes < maxMinutes;
  } catch {
    return false;
  }
}

export const parseAirbnb = async (url) => {
  let text;

  if (useCached || await isCacheFresh(CACHE_FILE, CACHE_MAX_AGE_MINUTES)) {
    console.log('💾 Using cached Airbnb .ics file');
    text = await fs.readFile(CACHE_FILE, 'utf-8');
  } else {
    console.log('🌐 Downloading fresh Airbnb .ics file');
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Failed to fetch .ics from Airbnb: ${res.status} ${res.statusText}`);
      return [];
    }
    text = await res.text();

    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(CACHE_FILE, text, 'utf-8');
    console.log('📥 Saved fresh .ics to cache');
  }

  // 🧵 Unfold lines (handle soft-wrapping per RFC 5545)
  text = text.replace(/\r?\n[ \t]/g, '');

  const events = text.split('BEGIN:VEVENT').slice(1);
  const bookings = [];

  for (const evt of events) {
    const getField = (tag) => {
      const regex = new RegExp(`${tag}(;[^:]*)?:(.*?)\\r?\\n`, 'i');
      const match = evt.match(regex);
      return match ? match[2].trim() : null;
    };

    const summary = getField('SUMMARY');
    if (!summary || summary.toLowerCase() !== 'reserved') {
      continue;
    }

    const checkin = getField('DTSTART');
    const checkout = getField('DTEND');
    const uid = getField('UID');
    const description = getField('DESCRIPTION') || '';

    // ✅ Extract full values now that line is unfolded
    const urlMatch = description.match(/Reservation URL:\s*(https:\/\/[^\s\\]+)/i);
    const phoneMatch = description.match(/Phone Number \(Last 4 Digits\):\s*(\d{4})/i);

    const reservationUrl = urlMatch ? urlMatch[1] : null;
    const phoneSuffix = phoneMatch ? phoneMatch[1] : null;

    const guest = 'Reserved';
    const id = `${checkin}_${guest.replace(/\s+/g, '_')}_Airbnb`;

    bookings.push({
      Guest: guest,
      Checkin: checkin,
      Checkout: checkout,
      Source: 'Airbnb',
      ID: id,
      Url: reservationUrl,
      Phone: phoneSuffix,
      Prenotazione: { start: checkin, end: checkout }
    });
  }

  console.log(`✅ Parsed Airbnb bookings: ${bookings.length}`);
  return bookings;
};