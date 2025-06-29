// src/set-status.js
import { Client } from '@notionhq/client';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.DATABASE_ID;

// Utility to fetch all pages from Notion DB with Status != Archiviata
async function fetchActiveNotionPages() {
  let results = [];
  let cursor = undefined;
  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Status',
        select: {
          does_not_equal: 'Archiviata'
        }
      },
      start_cursor: cursor,
      page_size: 100,
    });
    results = results.concat(response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);
  return results;
}

// Utility to fetch all pages from Notion DB with Status != Archiviata (for archiving check)
async function fetchAllNotionPages() {
  let results = [];
  let cursor = undefined;
  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Status',
        select: {
          does_not_equal: 'Archiviata'
        }
      },
      page_size: 100,
      start_cursor: cursor,
    });
    results = results.concat(response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);
  return results;
}

// Utility to update the Status property of a Notion page
async function updateStatus(pageId, newStatus) {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      Status: {
        select: { name: newStatus }
      }
    }
  });
  console.log(`🔄 Updated status to "${newStatus}" for page: ${pageId}`);
}

// Utility to update the Next check-in property of a Notion page
async function updateNextCheckIn(pageId, value) {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      "Next check-in": {
        checkbox: value
      }
    }
  });
  console.log(`🔄 Set "Next check-in" to ${value} for page: ${pageId}`);
}

function isPastDate(dateStr) {
  if (!dateStr) return false;
  let d;
  if (/^\d{8}$/.test(dateStr)) {
    d = new Date(
      Number(dateStr.slice(0, 4)),
      Number(dateStr.slice(4, 6)) - 1,
      Number(dateStr.slice(6, 8))
    );
  } else {
    d = new Date(dateStr);
  }
  d.setHours(23, 59, 59, 999);
  const now = new Date();
  return d < now;
}

async function archivePastReservations() {
  console.log('🗃️ Archiving past reservations...');
  const allPages = await fetchAllNotionPages();
  let archived = 0;
  for (const page of allPages) {
    const props = page.properties;
    const status = props['Status']?.select?.name;
    const prenotazione = props['Prenotazione']?.date;
    const endDate = prenotazione?.end;
    if (status !== 'Archiviata' && endDate && isPastDate(endDate)) {
      await updateStatus(page.id, 'Archiviata');
      archived++;
    }
  }
  console.log(`✅ Archived ${archived} past reservations.`);
}

export async function updateStatuses() {
  await archivePastReservations();

  console.log('🔎 Fetching Notion pages with Status != Archiviata...');
  const pages = await fetchActiveNotionPages();
  console.log(`📄 Found ${pages.length} active pages.`);

  // Load current reservation IDs from the generated JSON file
  let currentIDs = [];
  try {
    const jsonPath = path.join('ics', 'current_reservations.json');
    const jsonText = await fs.readFile(jsonPath, 'utf-8');
    currentIDs = JSON.parse(jsonText);
  } catch (err) {
    console.error('❌ Failed to read current_reservations.json:', err.message);
    currentIDs = [];
  }
  const currentIDSet = new Set(currentIDs);

  // Track if any status was changed
  let statusChanged = false;

  for (const page of pages) {
    const props = page.properties;
    const id = props['ID']?.formula?.string;
    const status = props['Status']?.select?.name;

    if (!id) {
      console.log(`⚠️ Skipping page with missing ID: ${page.id}`);
      continue;
    }

    if (currentIDSet.has(id)) {
      // Reservation is present in .json
      if (status !== 'Confermata') {
        await updateStatus(page.id, 'Confermata');
        statusChanged = true;
      }
    } else {
      // Reservation is NOT present in .json
      if (status === 'Confermata') {
        await updateStatus(page.id, 'Cancellata');
        statusChanged = true;
      }
    }
  }

  if (!statusChanged) {
    console.log('ℹ️ No status changes detected, skipping Next check-in update.');
    console.log('✅ Status update complete.');
    return;
  }

  // Find the earliest future check-in date among active pages
  let minCheckInDate = null;
  let minCheckInPageId = null;
  for (const page of pages) {
    const prenotazione = page.properties['Prenotazione']?.date;
    const checkIn = prenotazione?.start;
    if (checkIn) {
      const checkInDate = new Date(checkIn);
      const now = new Date();
      // Only consider check-ins today or in the future
      if (checkInDate >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
        if (!minCheckInDate || checkInDate < minCheckInDate) {
          minCheckInDate = checkInDate;
          minCheckInPageId = page.id;
        }
      }
    }
  }

  // Set Next check-in property
  for (const page of pages) {
    if (page.id === minCheckInPageId) {
      await updateNextCheckIn(page.id, true);
    } else {
      await updateNextCheckIn(page.id, false);
    }
  }

  console.log('✅ Status update complete.');
}
