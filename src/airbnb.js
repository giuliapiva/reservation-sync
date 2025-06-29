// src/airbnb.js
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { execFile } from 'child_process';
import { promisify } from 'util';

dotenv.config();

const execFileAsync = promisify(execFile);

const CACHE_DIR = 'ics';
const CACHE_FILE = path.join(CACHE_DIR, 'airbnb.ics');
const CACHE_MAX_AGE_MINUTES = 60;
const useCached = process.env.DEBUG_CACHE === 'true';

// Icon URLs
const AIRBNB_COLOR_ICON = 'https://raw.githubusercontent.com/giuliapiva/reservation-sync/refs/heads/main/icon/airbnb_color.svg';
const AIRBNB_BW_ICON = 'https://raw.githubusercontent.com/giuliapiva/reservation-sync/refs/heads/main/icon/airbnb_bw.svg';

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

// This function fetches and caches the Airbnb ICS file ONCE per run.
// It returns the path to the cached file.
export async function fetchAndCacheAirbnbICS(url) {
  if (useCached || await isCacheFresh(CACHE_FILE, CACHE_MAX_AGE_MINUTES)) {
    console.log('💾 Using cached Airbnb .ics file');
    return CACHE_FILE;
  }
  console.log('🌐 Downloading fresh Airbnb .ics file');
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`⚠️ Fetch failed (${res.status}). Attempting browser emulation...`);
      const { stdout, stderr } = await execFileAsync('node', ['src/airbnb-browser-fetch.js', url]);
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
    } else {
      const text = await res.text();
      await fs.mkdir(CACHE_DIR, { recursive: true });
      await fs.writeFile(CACHE_FILE, text, 'utf-8');
      console.log('📥 Saved fresh .ics to cache');
    }
  } catch (err) {
    console.error('❌ Fetch failed:', err.message);
    return '';
  }
  return CACHE_FILE;
}

async function readICSFile(filePath) {
  try {
    const text = await fs.readFile(filePath, 'utf-8');
    return text.replace(/\r?\n[ \t]/g, ''); // unfold lines
  } catch (err) {
    console.error('❌ Failed to read ICS file:', err.message);
    return '';
  }
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
export const parseAirbnb = async (icsPath) => {
  const text = await readICSFile(icsPath);
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
      Source: 'Airbnb',
      ID: id,
      Url: reservationUrl,
      Phone: phoneSuffix,
      Prenotazione: { start: checkin, end: checkout },
      IconUrl: AIRBNB_COLOR_ICON
    });
  }

  console.log(`✅ Parsed Airbnb bookings: ${bookings.length}`);
  return bookings;
};

// 🔴 Unavailable blocks
export const parseAirbnbUnavailable = async (icsPath) => {
  const text = await readICSFile(icsPath);
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
    const url = 'https://www.airbnb.com/multicalendar/1148520485615870610';
    const id = `${checkin}_${guest.replace(/\s+/g, '_')}_Airbnb`;

    blocks.push({
      Guest: guest,
      Source: source,
      ID: id,
      Url: url,
      Phone: null,
      Prenotazione: { start: checkin, end: checkout },
      IconUrl: AIRBNB_BW_ICON
    });
  }

  console.log(`✅ Parsed Airbnb blocked dates: ${blocks.length}`);
  return blocks;
};
