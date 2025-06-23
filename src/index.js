import { Client } from '@notionhq/client';
import { parseAirbnb } from './airbnb.js';
import { parseBooking } from './booking.js';

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
  if (search.results.length > 0) return;

  await notion.pages.create({
    parent: { database_id: databaseId },
    properties: {
      Guest: { title: [{ text: { content: booking.Guest } }] },
      Checkin: { date: { start: booking.Checkin } },
      Checkout: { date: { start: booking.Checkout } },
      Source: { select: { name: booking.Source } },
      ID: { rich_text: [{ text: { content: booking.ID } }] }
    }
  });
};

const main = async () => {
  const tasks = [];

  if (platform === 'all' || platform === 'airbnb') {
    tasks.push(parseAirbnb(process.env.AIRBNB_ICS));
  }
  if (platform === 'all' || platform === 'booking') {
    tasks.push(parseBooking(process.env.BOOKING_ICS));
  }

  const allBookings = (await Promise.all(tasks)).flat();

  for (const b of allBookings) {
    try {
      await addToNotion(b);
      console.log(`✅ Synced: ${b.ID}`);
    } catch (err) {
      console.error(`❌ Failed: ${b.ID}`, err.message);
    }
  }
};

main();