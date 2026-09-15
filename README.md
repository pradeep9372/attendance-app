# Arai Team Attendance

A lightweight, installable Progressive Web App (PWA) for employee clock-in/clock-out, backed entirely by a Google Sheet — no database or paid hosting required.

Employees enter their ID, confirm In/Out, capture their GPS location, and enter a PIN to submit. Every entry is logged to a Google Sheet with a timestamp, coordinates, and a Google Maps link.

---

## Features

- 📍 **Location-verified attendance** — GPS coordinates are captured and saved with every entry
- 🔒 **PIN protection** — attendance can't be submitted with just an Employee ID; a matching PIN is required
- ⚡ **Fast lookups** — employee name/department shown instantly after typing an ID
- 📴 **Works offline** — the app shell loads even without a connection (though submitting still requires internet)
- 📲 **Installable** — added to a phone's home screen like a native app
- 🧾 **Zero database cost** — Google Sheets is the entire backend

---

## How it works

```
┌─────────────────┐        JSONP over HTTPS        ┌──────────────────────┐
│   PWA (GitHub    │ ───────────────────────────▶  │  Google Apps Script  │
│   Pages, static) │ ◀───────────────────────────  │   (Web App backend)  │
└─────────────────┘                                 └──────────┬───────────┘
                                                                 │
                                                                 ▼
                                                        ┌──────────────────┐
                                                        │   Google Sheet    │
                                                        │ (Employees /       │
                                                        │  Attendance tabs)  │
                                                        └──────────────────┘
```

The frontend is static (HTML/CSS/JS) hosted for free on GitHub Pages. It talks to a Google Apps Script Web App deployed from the linked Google Sheet, using JSONP (since Apps Script Web Apps don't reliably support `fetch()`/CORS from a different origin).

---

## Project structure

```
├── index.html          # App markup
├── style.css           # Styling
├── app.js              # App logic (geolocation, JSONP calls, UI state)
├── config.js           # Holds the Apps Script Web App URL — edit this
├── manifest.json        # PWA manifest (name, icons, theme)
├── service-worker.js   # Offline caching (network-first, always fetches latest)
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── Code.gs             # Google Apps Script backend (lives in the Sheet, not here)
```

---

## Setup

### 1. Google Sheet

Create a Sheet with two tabs:

**Employees**

| Column | A | B | C | D |
|---|---|---|---|---|
| Header | Employee ID | Name | Department | PIN |

Fill in one row per employee. PIN is a plain 4–6 digit number of your choosing per employee.

**Attendance**

Created automatically by the script on first submission — no manual setup needed.

### 2. Apps Script backend

1. In the Sheet, go to **Extensions → Apps Script**
2. Paste in the contents of `Code.gs`
3. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Copy the deployed URL (ends in `/exec`)

### 3. Frontend config

Open `config.js` and paste the URL from step 2:

```js
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/XXXXXXXX/exec"
};
```

### 4. Host on GitHub Pages

1. Push all the frontend files (everything except `Code.gs`) to a GitHub repository
2. Repo **Settings → Pages** → set source to the `main` branch, root folder
3. Your app will be live at `https://<username>.github.io/<repo-name>/`

### 5. Install on a phone

Open the live URL in Chrome (Android) or Safari (iOS) → **Add to Home Screen**.

---

## Updating the app later

Because of browser and service-worker caching, changes to `style.css` or `app.js` sometimes don't show up immediately on phones that already visited the site. To force an update to always land immediately, bump the version number on the affected file's reference in `index.html`:

```html
<link rel="stylesheet" href="style.css?v=3" />
<script src="app.js?v=3"></script>
```

Increment `v=` by one each time you push a change to that file.

---

## Security notes

- PINs are stored as **plain values** in the Sheet for simplicity. Anyone with edit access to the Sheet can see them — restrict Sheet sharing accordingly.
- This system deters casual misuse (a coworker guessing/knowing someone's ID) but is **not** bank-grade authentication. It's appropriate for internal attendance tracking, not for higher-stakes access control.
- The Apps Script Web App is deployed with "Anyone" access so the PWA can reach it without a Google login prompt — this is required for the JSONP approach to work from a phone browser.

---

## Known limitations

- Apps Script Web Apps can take a few seconds to "wake up" after being idle — the app pings the backend on load to reduce this delay before the user hits Submit.
- Very large Employee/Attendance sheets (thousands of rows) will slow lookups, since the script scans rows linearly.

---

## License

Internal tool — no license specified. Adapt freely for your own team.
