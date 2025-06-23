import fetch from 'node-fetch';

/**
 * Parse Airbnb .ics calendar into booking objects compatible with Notion schema.
 * Adds fields: Checkin, Checkout, Guest, ID, Source, Url, Phone, Prenotazione
 */
export const parseAirbnb = async (url) => {
  const res = await fetch(url);
  const text = await res.text();
  const events = text.split('BEGIN:VEVENT').slice(1);

  return events.map(evt => {
    const getField = (tag) => {
      const regex = new RegExp(`${tag}(;VALUE=DATE)?:(.*?)\\r?\\n`, 'i');
      const match = evt.match(regex);
      return match ? match[2].trim() : null;
    };

    const checkin = getField('DTSTART');
    const checkout = getField('DTEND');
    const summary = getField('SUMMARY');
    const uid = getField('UID');

    if (!summary || summary.toLowerCase().includes('block')) return null;

    const guest = summary.replace(/(Reservation - |\\(.*?\\)|\\[.*?\\])/g, '').trim();
    const id = `${checkin}_${guest}_Airbnb`.replace(/\\s+/g, '_');

    // Example fixed values (or you can later fetch real ones if you have the reservation ID)
    const reservationUrl = 'https://www.airbnb.com/hosting/reservations/details/HMMZ2ZAJA3';
    const phoneSuffix = '4673';

    return {
      Guest: guest,
      Checkin: checkin,
      Checkout: checkout,
      Source: 'Airbnb',
      ID: id,
      Url: reservationUrl,
      Phone: phoneSuffix,
      Prenotazione: {
        start: checkin,
        end: checkout
      }
    };
  }).filter(Boolean);
};