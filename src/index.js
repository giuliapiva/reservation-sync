// src/index.js
import { Client } from '@notionhq/client';
import { fetchAndCacheAirbnbICS, parseAirbnb, parseAirbnbUnavailable } from './airbnb.js';
import { parseBooking } from './booking.js';
import { exportPersonalICS } from './personal.js';
import dotenv from 'dotenv';
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

  await notion.pages.create({
    parent: { database_id: databaseId },
    properties: props,
  });

  console.log(`✅ Synced: ${booking.ID}`);
};

const main = async () => {
  console.log("🔍 Starting main()...");

  const tasks = [];

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
  const allBookings = results.flat();
  console.log(`📦 Raw parsed results: ${allBookings.length} entries`);

  for (const booking of allBookings) {
    try {
      await addToNotion(booking);
    } catch (err) {
      console.error(`❌ Failed: ${booking.ID}`, err.message);
    }
  }

  console.log("✅ Sync complete.");
};

main();
