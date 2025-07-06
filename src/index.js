// src/index.js
import { Client } from '@notionhq/client';
import { fetchAndCacheAirbnbICS, parseAirbnb, parseAirbnbUnavailable } from './airbnb.js';
import { parseBooking } from './booking.js';
import { exportPersonalICS } from './personal.js';
import { updateStatuses } from './set-status.js';
import { displayCacheStatus } from './sync-utils.js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
dotenv.config();

console.log("👋 Reservation sync script started...");

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.DATABASE_ID;
const platform = process.env.PLATFORM || 'all';

const addToNotion = async (booking) => {
  const search = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: 'ID',
      rich_text: { equals: booking.ID }
    }
  });

  if (search.results.length > 0) {
    console.log(`🔁 Skipped (already exists): ${booking.ID}`);
    return;
  }

  const props = {
    Guest: { title: [{ text: { content: booking.Guest } }] },
    'Prenotazione': { date: booking.Prenotazione },
    'Tipo': { select: { name: booking.Source } },
    ID_ext: { rich_text: [{ text: { content: booking.ID } }] },
  };

  if (booking.Url) {
    props['url Prenotazione'] = { url: booking.Url };
  }

  if (booking.Phone) {
    props['Telefono'] = { rich_text: [{ text: { content: booking.Phone } }] };
  }

  // Set icon if available
  let icon = undefined;
  if (booking.IconUrl) {
    icon = {
      type: 'external',
      external: { url: booking.IconUrl }
    };
  }

  await notion.pages.create({
    parent: { database_id: databaseId },
    properties: props,
    ...(icon ? { icon } : {})
  });

  console.log(`✅ Synced: ${booking.ID}`);
};

const main = async () => {
  console.log("🔍 Starting main()...");
  
  // Display current cache status
  await displayCacheStatus();

  const tasks = [];
  let allBookings = [];

  let airbnbICSPath = null;
  if (platform === 'all' || platform === 'airbnb') {
    console.log("📥 Fetching Airbnb .ics...");
    airbnbICSPath = await fetchAndCacheAirbnbICS(process.env.AIRBNB_ICS);
    tasks.push(parseAirbnb(airbnbICSPath));
    tasks.push(parseAirbnbUnavailable(airbnbICSPath));
  }

  if (platform === 'all' || platform === 'booking') {
    console.log("📥 Fetching Booking.com bookings...");
    const bookingData = await parseBooking(process.env.BOOKING_ICS);
    tasks.push(Promise.resolve(bookingData)); // already saved to ics/booking.ics internally
  }

  if (platform === 'all' || platform === 'personal') {
    await exportPersonalICS(); // Save ics/personal.ics
  }

  console.log("⏳ Waiting for all parsers...");
  const results = await Promise.all(tasks);
  allBookings = results.flat();
  console.log(`📦 Raw parsed results: ${allBookings.length} entries`);

  // Save all current reservation IDs to a JSON file for set-status.js
  const currentIDs = allBookings.map(b => b.ID);
  const jsonPath = path.join('ics', 'current_reservations.json');
  await fs.mkdir('ics', { recursive: true });
  await fs.writeFile(jsonPath, JSON.stringify(currentIDs, null, 2), 'utf-8');
  console.log(`💾 Saved current reservation IDs to ${jsonPath}`);

  for (const booking of allBookings) {
    try {
      await addToNotion(booking);
    } catch (err) {
      console.error(`❌ Failed: ${booking.ID}`, err.message);
    }
  }

  // Call set-status logic after syncing
  await updateStatuses();

  console.log("✅ Sync complete.");
};

main();
