# 🏨 Ascend Collection Resorts Price Monitor

Automated room rate tracking system for **Bayview Wildwood Resort** (Severn Bridge, ON) and **The Grand Tappattoo Resort** (Seguin / Parry Sound, ON), both part of Choice Hotels' Ascend Hotel Collection.

Powered by **GitHub Actions** and **Node.js Playwright**, this project checks room prices every 6 hours and updates the interactive web dashboard.

---

## 🎯 Target Criteria

- **Monitored Resorts**:
  1. **Bayview Wildwood Resort, an Ascend Collection Resort** (Severn Bridge, ON)
  2. **The Grand Tappattoo Resort, an Ascend Collection Resort** (Seguin / Parry Sound, ON)
- **Occupancy**: 2 Adults, 2 Children (aged 9 & 9)
- **Monitored Date Ranges**:
  1. **Oct 10 – Oct 12** (2 nights)
  2. **Oct 9 – Oct 12** (3 nights)

---

## 🚀 Key Features

- 🕒 **Automated 6-Hour Runs**: GitHub Action runs every 6 hours automatically.
- 🔔 **Conditional Multi-Resort Email Alerts**: Sends emails ONLY when rates increase 🔺 or decrease 🟢 for any monitored resort.
- 🔄 **Manual Trigger Support**: Easily run on demand via GitHub Actions `workflow_dispatch`.
- 📊 **Interactive Web UI**: `index.html` renders current cheapest rates side-by-side, best rate highlights, filter controls, and historical price trend charts for both resorts.
- 💾 **Git Auto-Commit**: Automatically commits updated price logs back to `data/prices.json`.

---

## 📁 Repository Structure

```
├── .github/workflows/
│   └── daily-price-checker.yml   # GitHub Actions schedule & deploy workflow
├── data/
│   ├── prices.json               # Price database & history store for all resorts
│   └── prices.js                 # JS data wrapper for local browser viewing
├── scripts/
│   └── check-prices.js           # Multi-resort scraper script querying room rates
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

Open `index.html` in your web browser.
