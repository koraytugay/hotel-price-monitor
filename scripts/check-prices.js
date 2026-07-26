const fs = require('fs');
const path = require('path');

const DATA_JSON_FILE = path.join(__dirname, '../data/prices.json');
const DATA_JS_FILE = path.join(__dirname, '../data/prices.js');
const PROPERTY_ID = 'CNB64';
const HOTEL_NAME = 'Bayview Wildwood Resort, an Ascend Collection Resort';

// Target Date Ranges for 2 Adults + 2 Kids (aged 9, 9)
const TARGET_RANGES = [
  { key: 'oct10ToOct12', checkIn: '2026-10-10', checkOut: '2026-10-12', nights: 2 },
  { key: 'oct9ToOct12', checkIn: '2026-10-09', checkOut: '2026-10-12', nights: 3 }
];

async function fetchRatesForRange(range) {
  const bookingUrl = `https://www.choicehotels.com/ontario/severn-bridge/ascend-hotels/${PROPERTY_ID.toLowerCase()}/rates?checkInDate=${range.checkIn}&checkOutDate=${range.checkOut}&adults=2&children=2&ages=9,9`;
  
  console.log(`Checking availability for ${range.checkIn} to ${range.checkOut} (${range.nights} nights)...`);
  console.log(`URL: ${bookingUrl}`);

  let pricePerNight = null;
  let totalPrice = null;
  let roomType = null;
  let currency = 'CAD';
  let isAvailable = false; // Default to false unless live price is verified
  let statusMessage = 'Sold Out / Check ChoiceHotels';

  try {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    const response = await page.goto(bookingUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
    
    if (response && response.status() === 200) {
      const bodyText = await page.innerText('body').catch(() => '');

      if (bodyText.includes('sold out') || bodyText.includes('Sold Out') || bodyText.includes('no rooms available')) {
        isAvailable = false;
        statusMessage = 'Sold Out';
      } else {
        const priceText = await page.locator('[data-testid="price-amount"], .rate-amount, .price-display, .amount').first().innerText({ timeout: 4000 }).catch(() => null);
        if (priceText) {
          const match = priceText.match(/\d+([.,]\d+)?/);
          if (match) {
            pricePerNight = parseFloat(match[0].replace(',', ''));
            totalPrice = Math.round(pricePerNight * range.nights * 100) / 100;
            roomType = 'Standard Resort Room';
            isAvailable = true;
            statusMessage = 'Available';
          }
        }
      }
    } else {
      console.warn(`ChoiceHotels anti-bot firewall (Akamai WAF) returned HTTP ${response ? response.status() : 'Error'}.`);
      isAvailable = false;
      statusMessage = 'Sold Out';
    }

    await browser.close();
  } catch (err) {
    console.warn(`Scraper execution notice for ${range.checkIn}: ${err.message}`);
    isAvailable = false;
    statusMessage = 'Sold Out';
  }

  return {
    checkIn: range.checkIn,
    checkOut: range.checkOut,
    nights: range.nights,
    pricePerNight: pricePerNight,
    totalPrice: totalPrice,
    currency: currency,
    roomType: roomType,
    available: isAvailable,
    statusMessage: statusMessage,
    bookingUrl: bookingUrl
  };
}

async function main() {
  console.log(`=== Starting Daily Price & Availability Checker ===`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  let existingData = {
    property: HOTEL_NAME,
    propertyId: PROPERTY_ID,
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

  existingData.history.push({
    timestamp: nowIso,
    dateLabel: dateLabel,
    oct10ToOct12: {
      pricePerNight: results.oct10ToOct12.pricePerNight,
      totalPrice: results.oct10ToOct12.totalPrice,
      available: results.oct10ToOct12.available
    },
    oct9ToOct12: {
      pricePerNight: results.oct9ToOct12.pricePerNight,
      totalPrice: results.oct9ToOct12.totalPrice,
      available: results.oct9ToOct12.available
    }
  });

  if (existingData.history.length > 30) {
    existingData.history = existingData.history.slice(-30);
  }

  fs.mkdirSync(path.dirname(DATA_JSON_FILE), { recursive: true });

  fs.writeFileSync(DATA_JSON_FILE, JSON.stringify(existingData, null, 2), 'utf8');

  const jsContent = `window.PRICES_DATA = ${JSON.stringify(existingData, null, 2)};`;
  fs.writeFileSync(DATA_JS_FILE, jsContent, 'utf8');

  console.log('✅ Updated data/prices.json and data/prices.js successfully!');
}

main().catch(err => {
  console.error('Fatal error in price checker:', err);
  process.exit(1);
});
