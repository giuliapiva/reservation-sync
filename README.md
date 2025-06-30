# 🏡 reservation-sync

A Node.js automation tool to sync Airbnb and Booking.com reservations into a Notion calendar database, and export personal events to an `.ics` file for use in external calendar apps.

**🔗 View the live Notion calendar:**  
[Poggio Ancisa Relais Notion Calendar ↗](#)

---

## ✨ Features

- ✅ Sync reservations from Airbnb `.ics` feed  
- ✅ Sync reservations from Booking.com `.ics` feed  
- ✅ Create Notion entries with guest info, reservation dates, and source  
- ✅ Avoid duplicates using a unique ID formula  
- ✅ Sync “Airbnb (Not available)” blocks as separate entries  
- ✅ Export `Personal`-tagged Notion events to `.ics`  
- ✅ Automatically assign icons in Notion for each source  
- ✅ Reservation status management (Confermata, Cancellata, Archiviata)  
- ✅ Automatically archive past reservations  
- ✅ Highlight the next upcoming check-in  
- ✅ Generate WhatsApp links for guest phone numbers  
- ✅ GitHub Actions support to automate syncing daily at 7 AM  
- ✅ Local `.env` support for testing and debugging

---

## 🛠 Requirements

- Node.js `>= 18`
- A Notion integration with access to your database
- A Notion database with the following properties:

| Property Name      | Type        | Notes                                      |
|--------------------|-------------|--------------------------------------------|
| `Guest`            | Title       | Guest name                                 |
| `Prenotazione`     | Date        | Reservation start and end dates            |
| `Tipo`             | Select      | Airbnb, Booking, Personal, Airbnb (Block)  |
| `ID_ext`           | Rich text   | External unique ID                         |
| `ID`               | Formula     | Used to deduplicate entries                |
| `url Prenotazione` | URL         | Optional                                   |
| `Telefono`         | Rich text   | Optional                                   |
| `Status`           | Select      | Archiviata, Cancellata, Confermata         |
| `Next check-in`    | Checkbox    | Automatically managed                      |

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/reservation-sync.git
cd reservation-sync
```

### 2. Set up your `.env` file

Create a `.env` file in the project root:

```env
NOTION_TOKEN=your_notion_secret
DATABASE_ID=your_notion_database_id
AIRBNB_ICS=https://www.airbnb.com/calendar/ical/your_id.ics?your_token
BOOKING_ICS=https://ical.booking.com/v1/export?t=your_token
PLATFORM=all
DEBUG_CACHE=false
```

### 3. Install dependencies

```bash
npm install
```

### 4. Run the sync script

```bash
node src/index.js
```

---

## ⚙️ Notion Database Setup

Ensure your Notion database includes these properties and types:

- `Guest` (Title)
- `Prenotazione` (Date, with start and end)
- `Tipo` (Select: Airbnb, Booking, Personal, Airbnb (Block))
- `ID_ext` (Rich text)
- `ID` (Formula)
- `url Prenotazione` (URL, optional)
- `Telefono` (Rich text, optional)
- `Status` (Select: Archiviata, Cancellata, Confermata)
- `Next check-in` (Checkbox)

Your Notion integration must be invited to the database and have permission to read/write.

---

## 🖼️ Icon Support

Automatically assigns icons to Notion pages:

- 🟠 **Airbnb reservations:** Airbnb logo (colored)
- ⚫ **Airbnb blocks:** Airbnb logo (black & white)
- 🔵 **Booking.com reservations:** Booking.com logo

---

## 🔄 Status & Archiving

- ✅ **Confermata** if present in the latest `.ics` sync  
- ❌ **Cancellata** if removed from `.ics` feeds  
- 🗃 **Archiviata** if the reservation has ended  
- 🌟 `Next check-in` is automatically set for the soonest upcoming reservation

---

## 🗓️ Personal Events Export

All Notion entries with `Tipo` set to `Personal` (and not archived) are exported to:

```
ics/personal.ics
```

This `.ics` file can be imported into Google Calendar, Apple Calendar, Outlook, etc.

---

## 🤖 Automation

This repo includes a GitHub Actions workflow that:

- Syncs reservations daily at 7 AM (UTC)
- Commits updated `.ics` files back into the repository
- Can also be triggered manually via GitHub UI (`workflow_dispatch`)

---

## 📄 License

MIT License