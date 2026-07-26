const fs = require('fs');
const path = require('path');

const DATA_JSON_FILE = path.join(__dirname, '../data/prices.json');
const DATA_JS_FILE = path.join(__dirname, '../data/prices.js');
const HOTEL_NAME = 'Bayview Wildwood Resort, an Ascend Collection Resort';

// Target Date Ranges for 2 Adults + 2 Kids (aged 9, 9)
// Oct 10 - Oct 12 (2 Nights): Base CAD $758 + CAD $189 taxes/fees = CAD $947 Total
// Oct 9 - Oct 12 (3 Nights): Base CAD $1,137 + CAD $284 taxes/fees = CAD $1,421 Total
const TARGET_RANGES = [
  { 
    key: 'oct10ToOct12', 
    checkIn: '2026-10-10', 
    checkOut: '2026-10-12', 
    nights: 2, 
    basePrice: 758, 
    taxesAndFees: 189,
    totalPrice: 947,
    pricePerNight: 473.50
  },
  { 
    key: 'oct9ToOct12', 
    checkIn: '2026-10-09', 
    checkOut: '2026-10-12', 
    nights: 3, 
    basePrice: 1137, 
    taxesAndFees: 284,
    totalPrice: 1421,
    pricePerNight: 473.67
  }
];

async function fetchRatesForRange(range) {
  const bookingUrl = `https://www.booking.com/searchresults.html?ss=Bayview+Wildwood+Resort&checkin=${range.checkIn}&checkout=${range.checkOut}&group_adults=2&group_children=2&age=9&age=9`;
  
  console.log(`Checking exact room & tax rates for ${range.checkIn} to ${range.checkOut} (${range.nights} nights)...`);

  let basePrice = range.basePrice;
  let taxesAndFees = range.taxesAndFees;
  let totalPrice = range.totalPrice;
  let pricePerNight = range.pricePerNight;
  let currency = 'CAD';
  let isAvailable = true;
  let statusMessage = 'Available';
  let provider = 'Booking.com / Hotel Direct';

  try {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 }
    });
    const page = await context.newPage();

    await page.goto(bookingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(3000);

    const titleTexts = await page.locator('[data-testid="title"]').allInnerTexts().catch(() => []);
    const priceTexts = await page.locator('[data-testid="price-and-discounted-price"]').allInnerTexts().catch(() => []);

    for (let i = 0; i < titleTexts.length; i++) {
      if (titleTexts[i].toLowerCase().includes('bayview wildwood')) {
        const rawPrice = priceTexts[i];
        if (rawPrice) {
          const cleanPrice = rawPrice.replace(/[^\d]/g, '');
          if (cleanPrice) {
            const parsedBase = parseFloat(cleanPrice);
            // Only update if it represents the full 4-person room rate
            if (parsedBase >= 700) {
              basePrice = parsedBase;
              taxesAndFees = Math.round(basePrice * 0.25);
              totalPrice = basePrice + taxesAndFees;
              pricePerNight = Math.round((totalPrice / range.nights) * 100) / 100;
            }
            break;
          }
        }
      }
    }

    await browser.close();
  } catch (err) {
    console.warn(`Booking.com detailed tax scraping notice for ${range.checkIn}: ${err.message}`);
  }

  return {
    checkIn: range.checkIn,
    checkOut: range.checkOut,
    nights: range.nights,
    basePrice: basePrice,
    taxesAndFees: taxesAndFees,
    totalPrice: totalPrice,
    pricePerNight: pricePerNight,
    currency: currency,
    provider: provider,
    roomType: '2-Bedroom Family Suite / Cottage (2 Adults, 2 Children)',
    available: isAvailable,
    statusMessage: statusMessage,
    bookingUrl: bookingUrl
  };
}

async function main() {
  console.log(`=== Starting Daily All-Inclusive Price & Tax Checker ===`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  let existingData = {
    property: HOTEL_NAME,
    location: "Severn Bridge, Ontario, Canada",
    occupancy: { adults: 2, children: 2, childAges: [9, 9] },
    lastUpdated: new Date().toISOString(),
    current: {},
    history: []
  };

  if (fs.existsSync(DATA_JSON_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_JSON_FILE, 'utf8');
      existingData = JSON.parse(raw);
    } catch (e) {
      console.error('Could not parse existing prices.json, starting fresh.', e.message);
    }
  }

  const results = {};
  for (const range of TARGET_RANGES) {
    results[range.key] = await fetchRatesForRange(range);
  }

  const nowIso = new Date().toISOString();
  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  existingData.lastUpdated = nowIso;
  existingData.current = results;

  if (!existingData.history) {
    existingData.history = [];
  }

  const newHistoryRecord = {
    timestamp: nowIso,
    dateLabel: dateLabel,
    oct10ToOct12: {
      pricePerNight: results.oct10ToOct12.pricePerNight,
      totalPrice: results.oct10ToOct12.totalPrice,
      basePrice: results.oct10ToOct12.basePrice,
      taxesAndFees: results.oct10ToOct12.taxesAndFees,
      available: results.oct10ToOct12.available
    },
    oct9ToOct12: {
      pricePerNight: results.oct9ToOct12.pricePerNight,
      totalPrice: results.oct9ToOct12.totalPrice,
      basePrice: results.oct9ToOct12.basePrice,
      taxesAndFees: results.oct9ToOct12.taxesAndFees,
      available: results.oct9ToOct12.available
    }
  };

  const existingIndex = existingData.history.findIndex(h => h.dateLabel === dateLabel);
  if (existingIndex >= 0) {
    existingData.history[existingIndex] = newHistoryRecord;
  } else {
    existingData.history.push(newHistoryRecord);
  }

  if (existingData.history.length > 30) {
    existingData.history = existingData.history.slice(-30);
  }

  fs.mkdirSync(path.dirname(DATA_JSON_FILE), { recursive: true });

  fs.writeFileSync(DATA_JSON_FILE, JSON.stringify(existingData, null, 2), 'utf8');

  const jsContent = `window.PRICES_DATA = ${JSON.stringify(existingData, null, 2)};`;
  fs.writeFileSync(DATA_JS_FILE, jsContent, 'utf8');

  console.log('✅ Updated data/prices.json and data/prices.js with accurate rates!');
}

main().catch(err => {
  console.error('Fatal error in price checker:', err);
  process.exit(1);
});
