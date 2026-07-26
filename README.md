# 🏨 Bayview Wildwood Resort Price Monitor

Automated price tracking system for **Bayview Wildwood Resort, an Ascend Collection Resort** (Severn Bridge, ON).

Powered by **GitHub Actions** and **Node.js Playwright**, this project checks room prices daily and updates the interactive web dashboard.

---

## 🎯 Target Criteria

- **Resort**: Bayview Wildwood Resort (Choice Hotels Property `CNB64`)
- **Occupancy**: 2 Adults, 2 Children (aged 9 & 9)
- **Monitored Date Ranges**:
  1. **Oct 10 – Oct 12** (2 nights)
  2. **Oct 9 – Oct 12** (3 nights)

---

## 🚀 Key Features

- 🕒 **Automated Daily Runs**: GitHub Action runs every day at 08:00 UTC.
- 🔄 **Manual Trigger Support**: Easily run on demand via GitHub Actions `workflow_dispatch`.
- 📊 **Interactive Web UI**: `index.html` renders current cheapest rates, stay breakdown, and historical price trend charts.
- 💾 **Git Auto-Commit**: Automatically commits updated price logs back to `data/prices.json`.

---

## 📁 Repository Structure

```
├── .github/workflows/
│   └── daily-price-checker.yml   # GitHub Actions daily schedule & commit workflow
├── data/
│   └── prices.json               # Price database & history store
├── scripts/
│   └── check-prices.js           # Scraper script querying Choice Hotels rates
├── index.html                    # Dashboard UI
├── styles.css                    # Design system & responsive layout
├── app.js                        # Client JS for rendering & Chart.js graph
└── package.json                  # Dependencies
```

---

## 🧪 Local Testing

To test the price checking script locally:

```bash
npm install
node scripts/check-prices.js
```

To view the web dashboard locally:

Open `index.html` in your web browser or serve it using any local HTTP server (e.g. `npx serve .`).
