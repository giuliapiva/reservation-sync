// src/set-status.js
import { Client } from '@notionhq/client';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.DATABASE_ID;

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

export async function updateStatuses() {
  // 1. Fetch all non-archived pages ONCE
  let pages = await fetchActiveNotionPages();
  console.log(`📄 Fetched ${pages.length} non-archived pages.`);

  // 2. Load current reservation IDs from the generated JSON file
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

  // 3. Update status in local variable
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  pages = pages.map(page => {
    const props = page.properties;
    const id = props['ID']?.formula?.string;
    const status = props['Status']?.select?.name;
    const prenotazione = props['Prenotazione']?.date;
    const endDate = prenotazione?.end;
    const tipo = props['Tipo']?.select?.name;

    let newStatus = status;

    // Archive if end date is in the past
    if (endDate && isPastDate(endDate)) {
      newStatus = 'Archiviata';
    } else if (id && currentIDSet.has(id)) {
      if (status !== 'Confermata') newStatus = 'Confermata';
    } else {
      // Only set to Cancellata if not Personal
      if (status === 'Confermata' && tipo !== 'Personal') newStatus = 'Cancellata';
    }

    return {
      ...page,
      _localStatus: newStatus
    };
  });

  // 4. Filter for next check-in assignment:
  //    - status != "Cancellata"
  const candidates = pages.filter(page => {
    const status = page._localStatus;
    return status !== 'Cancellata';
  });

  // 5. Find the earliest future check-in among candidates
  let minCheckInDate = null;
  let minCheckInPageId = null;
  for (const page of candidates) {
    const prenotazione = page.properties['Prenotazione']?.date;
    const checkIn = prenotazione?.start;
    if (checkIn) {
      const checkInDate = new Date(checkIn);
      checkInDate.setHours(0, 0, 0, 0);
      if (checkInDate >= now) {
        if (!minCheckInDate || checkInDate < minCheckInDate) {
          minCheckInDate = checkInDate;
          minCheckInPageId = page.id;
        }
      }
    }
  }

  // 6. Prepare updates: only update rows that changed
  const updates = [];
  for (const page of pages) {
    const id = page.id;
    const oldStatus = page.properties['Status']?.select?.name;
    const newStatus = page._localStatus;
    const oldNextCheckIn = page.properties['Next check-in']?.checkbox || false;
    const shouldBeNextCheckIn = id === minCheckInPageId;

    // Only update if status or next check-in changed
    if (oldStatus !== newStatus || oldNextCheckIn !== shouldBeNextCheckIn) {
      updates.push({
        pageId: id,
        status: newStatus,
        nextCheckIn: shouldBeNextCheckIn,
        oldStatus,
        oldNextCheckIn
      });
    }
  }

  // 7. Apply updates
  for (const update of updates) {
    const props = {};
    if (update.oldStatus !== update.status) {
      props.Status = { select: { name: update.status } };
      console.log(`🔄 Updated status to "${update.status}" for page: ${update.pageId}`);
    }
    if (update.oldNextCheckIn !== update.nextCheckIn) {
      props["Next check-in"] = { checkbox: update.nextCheckIn };
      console.log(`🔄 Set "Next check-in" to ${update.nextCheckIn} for page: ${update.pageId}`);
    }
    if (Object.keys(props).length > 0) {
      await notion.pages.update({
        page_id: update.pageId,
        properties: props
      });
    }
  }

  console.log('✅ Status and next check-in update complete.');
}
