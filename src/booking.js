import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const CACHE_DIR = 'ics';
const CACHE_FILE = path.join(CACHE_DIR, 'booking.ics');
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

export const parseBooking = async (url) => {
  let text;

  if (useCached || await isCacheFresh(CACHE_FILE, CACHE_MAX_AGE_MINUTES)) {
    console.log('💾 Using cached Booking.com .ics file');
    text = await fs.readFile(CACHE_FILE, 'utf-8');
  } else {
    console.log('🌐 Downloading fresh Booking.com .ics file');
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Failed to fetch .ics from Booking.com: ${res.status} ${res.statusText}`);
      return [];
    }
    text = await res.text();

    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(CACHE_FILE, text, 'utf-8');
    console.log('📥 Saved fresh .ics to cache');
  }

  text = text.replace(/\r?\n[ \t]/g, '');

  const events = text.split('BEGIN:VEVENT').slice(1);
  const bookings = [];

  for (const evt of events) {
    const getField = (tag) => {
      const regex = new RegExp(`${tag}(;[^:]*)?:(.*?)\r?\n`, 'i');
      const match = evt.match(regex);
      return match ? match[2].trim() : null;
    };

    const checkin = getField('DTSTART');
    const checkout = getField('DTEND');
    const summary = getField('SUMMARY') || 'Booked';
    const uid = getField('UID') || 'unknown';

    if (!checkin || !checkout) continue;

    const guest = 'Booked';
    const url = 'https://admin.booking.com/hotel/hoteladmin/extranet_ng/manage/calendar/index.html?ses=185c96397508c1ca99f4774af9a0afd9&lang=it&hotel_id=11994497';
    const id = `${checkin}_${guest.replace(/\s+/g, '_')}_Booking`;

    bookings.push({
      Guest: guest,
      Source: 'Booking',
      ID: id,
      Url: url,
      Phone: null,
      Prenotazione: { start: checkin, end: checkout }
    });
  }

  console.log(`✅ Parsed Booking.com bookings: ${bookings.length}`);
  return bookings;
};