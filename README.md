# 🏡 reservation-sync

A Node.js-based automation tool to **sync Airbnb and Booking.com reservations** into a Notion calendar database, and **export personal events** to an `.ics` file for external calendar use.

## ✨ Features

- ✅ Sync reservations from Airbnb `.ics` feed  
- ✅ Sync reservations from Booking.com `.ics` feed  
- ✅ Create Notion entries with guest info, reservation dates, and source  
- ✅ Avoid duplicates by checking existing IDs  
- ✅ Sync "Airbnb (Not available)" blocks as separate entries  
- ✅ Export `Personal`-tagged Notion events to `.ics`  
- ✅ GitHub Actions support to automate syncing daily at 7AM  
- ✅ Local `.env` support for testing and debugging

---

## 🛠 Requirements

- Node.js >= 18  
- A Notion integration with database access  
- Notion database with the following properties:
  - `Guest` (Title)
  - `Prenotazione` (Date)
  - `Tipo` (Select: e.g. Airbnb, Booking, Personal)
  - `ID_ext` (rich_text or formula fallback)
  - `url Prenotazione` (URL - optional)
  - `Telefono` (rich_text - optional)

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/reservation-sync.git
cd reservation-sync