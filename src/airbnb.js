import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const CACHE_DIR = 'ics';
const CACHE_FILE = path.join(CACHE_DIR, 'airbnb.ics');
const CACHE_MAX_AGE_MINUTES = 60;
const useCached = process.env.DEBUG_CACHE === 'true';

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

async function fetchOrReadICS(url) {
  let text;
  if (useCached || await isCacheFresh(CACHE_FILE, CACHE_MAX_AGE_MINUTES)) {
    console.log('💾 Using cached Airbnb .ics file');
    text = await fs.readFile(CACHE_FILE, 'utf-8');
  } else {
    console.log('🌐 Downloading fresh Airbnb .ics file');
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Failed to fetch .ics from Airbnb: ${res.status} ${res.statusText}`);
      return '';
    }
    text = await res.text();
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(CACHE_FILE, text, 'utf-8');
    console.log('📥 Saved fresh .ics to cache');
  }

  return text.replace(/\r?\n[ \t]/g, ''); // unfold lines
}

function parseEvents(text) {
  return text.split('BEGIN:VEVENT').slice(1);
}

function getField(evt, tag) {
  const regex = new RegExp(`${tag}(;[^:]*)?:(.*?)\\r?\\n`, 'i');
  const match = evt.match(regex);
  return match ? match[2].trim() : null;
}

// 🔵 Reserved bookings
export const parseAirbnb = async (url) => {
  const text = await fetchOrReadICS(url);
  if (!text) return [];

  const events = parseEvents(text);
  const bookings = [];

  for (const evt of events) {
    const summary = getField(evt, 'SUMMARY');
    if (!summary || summary.toLowerCase() !== 'reserved') continue;

    const checkin = getField(evt, 'DTSTART');
    const checkout = getField(evt, 'DTEND');
    const description = getField(evt, 'DESCRIPTION') || '';

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

// 🔴 Blocked unavailable ranges
export const parseAirbnbUnavailable = async (url) => {
  const text = await fetchOrReadICS(url);
  if (!text) return [];

  const events = parseEvents(text);
  const blocks = [];

  for (const evt of events) {
    const summary = getField(evt, 'SUMMARY');
    if (!summary || !summary.toLowerCase().includes('not available')) continue;

    const checkin = getField(evt, 'DTSTART');
    const checkout = getField(evt, 'DTEND');
    if (!checkin || !checkout) continue;

    const guest = 'Airbnb (Not available)';
    const source = 'Airbnb (Block)';
    const url = 'https://www.airbnb.com/multicalendar/1148520485615870610/availability-settings';
    const id = `${checkin}_${guest.replace(/\s+/g, '_')}_Airbnb`;

    blocks.push({
      Guest: guest,
      Checkin: checkin,
      Checkout: checkout,
      Source: source,
      ID: id,
      Url: url,
      Phone: null,
      Prenotazione: { start: checkin, end: checkout }
    });
  }

  console.log(`✅ Parsed Airbnb blocked dates: ${blocks.length}`);
  return blocks;
};