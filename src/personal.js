// src/personal.js

import { Client } from '@notionhq/client';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.DATABASE_ID;

const icsHeader = `BEGIN:VCALENDAR
VERSION:2.0
CALSCALE:GREGORIAN
PRODID:-//personal-sync//EN`;

const icsFooter = `END:VCALENDAR`;

const formatDate = (yyyymmdd) => {
  return `${yyyymmdd}T000000Z`;
};

const exportPersonalICS = async () => {
  console.log('📤 Exporting Personal events to ICS...');

  let pages = [];
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
    });

    pages = response.results || [];
    console.log(`📄 Total Notion pages fetched: ${pages.length}`);
  } catch (err) {
    console.error('❌ Failed to query Notion:', err.message);
    return;
  }

  const personalEvents = [];

  for (const page of pages) {
    const props = page.properties;
    const sito = props['Sito']?.select?.name;
    const guest = props['Guest']?.title?.[0]?.text?.content;
    const id = props['ID']?.rich_text?.[0]?.text?.content;
    const prenotazione = props['Prenotazione']?.date;

    if (sito !== 'Personal') {
      continue;
    }

    if (!prenotazione?.start || !prenotazione?.end || !id) {
      console.log(`⚠️ Skipping entry with missing fields: ${guest}`);
      continue;
    }

    const event = `BEGIN:VEVENT
SUMMARY:${guest}
UID:${id}@personal-sync
DTSTART:${formatDate(prenotazione.start)}
DTEND:${formatDate(prenotazione.end)}
END:VEVENT`;

    personalEvents.push(event);
  }

  console.log(`📆 Personal events to export: ${personalEvents.length}`);

  const icsContent = [icsHeader, ...personalEvents, icsFooter].join('\n');

  const icsPath = path.join('ics', 'personal.ics');
  await fs.mkdir('ics', { recursive: true });
  await fs.writeFile(icsPath, icsContent, 'utf-8');

  console.log(`✅ Saved to ${icsPath} (${personalEvents.length} events)`);
};

exportPersonalICS();