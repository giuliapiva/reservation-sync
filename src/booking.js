// src/booking.js
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { isCacheFreshFromSync, updateFileTimestamp } from './sync-utils.js';
dotenv.config();

const CACHE_DIR = 'ics';
const CACHE_FILE = path.join(CACHE_DIR, 'booking.ics');
const CACHE_MAX_AGE_MINUTES = 60;
const useCached = process.env.DEBUG_CACHE === 'true';

// Icon URL
const BOOKING_ICON = 'https://raw.githubusercontent.com/giuliapiva/reservation-sync/refs/heads/main/icon/booking.svg';

export const parseBooking = async (url) => {
  let text;

  if (useCached || await isCacheFreshFromSync('booking.ics', CACHE_MAX_AGE_MINUTES)) {
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
    await updateFileTimestamp('booking.ics');
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
      Prenotazione: { start: checkin, end: checkout },
      IconUrl: BOOKING_ICON
    });
  }

  console.log(`✅ Parsed Booking.com bookings: ${bookings.length}`);
  return bookings;
};
