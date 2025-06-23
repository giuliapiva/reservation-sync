import { Client } from '@notionhq/client';
import { parseAirbnb } from './airbnb.js';
import { parseBooking } from './booking.js'; // placeholder for future
import dotenv from 'dotenv';
dotenv.config();

console.log("👋 Airbnb sync script started...");

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.DATABASE_ID;
const platform = process.env.PLATFORM || 'all';

const addToNotion = async (booking) => {
  const search = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: 'ID_airbnb',
      rich_text: { equals: booking.ID }
    }
  });

  if (search.results.length > 0) {
    console.log(`🔁 Skipped (already exists): ${booking.ID}`);
    return;
  }

  await notion.pages.create({
    parent: { database_id: databaseId },
    properties: {
      Guest: { title: [{ text: { content: booking.Guest } }] },
      'Check-in': { date: { start: booking.Checkin } },
      'Check-out': { date: { start: booking.Checkout } },
      'Prenotazione': { date: booking.Prenotazione }, // { start, end }
      'Sito': { select: { name: booking.Source } },
      'ID_airbnb': { rich_text: [{ text: { content: booking.ID } }] },
      'url Prenotazione': booking.Url ? { url: booking.Url } : undefined,
      'Telefono': booking.Phone ? { rich_text: [{ text: { content: booking.Phone } }] } : undefined
    }
  });

  console.log(`✅ Synced: ${booking.ID}`);
};

const main = async () => {
  console.log("🔍 Starting main()...");

  const tasks = [];

  if (platform === 'all' || platform === 'airbnb') {
    console.log("📥 Fetching Airbnb bookings...");
    tasks.push(parseAirbnb(process.env.AIRBNB_ICS));
  }

  if (platform === 'all' || platform === 'booking') {
    console.log("📥 Fetching Booking.com bookings...");
    tasks.push(parseBooking(process.env.BOOKING_ICS)); // placeholder for future
  }

  console.log("⏳ Waiting for all parsers...");
  const results = await Promise.all(tasks);

  console.log("📦 Raw results from parsers:", results);

  const allBookings = results.flat();

  console.log(`🧾 Total parsed bookings: ${allBookings.length}`);

  for (const booking of allBookings) {
    console.log(`➡️  Processing booking: ${booking.ID}`);
    try {
      await addToNotion(booking);
    } catch (err) {
      console.error(`❌ Failed: ${booking.ID}`, err.message);
    }
  }

  console.log("✅ Sync complete.");
};

main();