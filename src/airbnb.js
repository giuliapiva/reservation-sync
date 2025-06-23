import fetch from 'node-fetch';

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
    if (!summary || summary.toLowerCase().includes('block')) return null;

    const guest = summary.replace(/(Reservation - |\\(.*?\\)|\\[.*?\\])/g, '').trim();
    const id = `${checkin}_${guest}_Airbnb`.replace(/\s+/g, '_');

    return {
      Checkin: checkin,
      Checkout: checkout,
      Guest: guest,
      Source: 'Airbnb',
      ID: id
    };
  }).filter(Boolean);
};
