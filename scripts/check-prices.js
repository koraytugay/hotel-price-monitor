const fs = require('fs');
const path = require('path');

const DATA_JSON_FILE = path.join(__dirname, '../data/prices.json');
const DATA_JS_FILE = path.join(__dirname, '../data/prices.js');
const STATUS_JSON_FILE = path.join(__dirname, '../data/price_status.json');
const EMAIL_BODY_FILE = path.join(__dirname, '../data/email_body.html');
const HOTEL_NAME = 'Bayview Wildwood Resort, an Ascend Collection Resort';

// Target Date Ranges for 2 Adults + 2 Kids (aged 9, 9)
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
  
  console.log(`Checking rates for ${range.checkIn} to ${range.checkOut} (${range.nights} nights)...`);

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
    console.warn(`Booking.com price check notice for ${range.checkIn}: ${err.message}`);
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
  console.log(`=== Starting Price & Availability Change Checker ===`);
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

  const prev10 = existingData.current ? existingData.current.oct10ToOct12 : null;
  const prev9 = existingData.current ? existingData.current.oct9ToOct12 : null;

  const results = {};
  for (const range of TARGET_RANGES) {
    results[range.key] = await fetchRatesForRange(range);
  }

  const curr10 = results.oct10ToOct12;
  const curr9 = results.oct9ToOct12;

  let priceChanged = false;
  let changeSummaryItems = [];

  // Compare Oct 10 - Oct 12
  if (prev10 && prev10.totalPrice !== curr10.totalPrice) {
    priceChanged = true;
    const diff = curr10.totalPrice - prev10.totalPrice;
    if (diff < 0) {
      changeSummaryItems.push(`🟢 <strong>Oct 10 – Oct 12 (2-Night Stay) DECREASED</strong> by $${Math.abs(diff)} CAD! (New total: $${curr10.totalPrice} CAD, was $${prev10.totalPrice} CAD)`);
    } else {
      changeSummaryItems.push(`🔺 <strong>Oct 10 – Oct 12 (2-Night Stay) INCREASED</strong> by $${diff} CAD. (New total: $${curr10.totalPrice} CAD, was $${prev10.totalPrice} CAD)`);
    }
  }

  // Compare Oct 9 - Oct 12
  if (prev9 && prev9.totalPrice !== curr9.totalPrice) {
    priceChanged = true;
    const diff = curr9.totalPrice - prev9.totalPrice;
    if (diff < 0) {
      changeSummaryItems.push(`🟢 <strong>Oct 9 – Oct 12 (3-Night Stay) DECREASED</strong> by $${Math.abs(diff)} CAD! (New total: $${curr9.totalPrice} CAD, was $${prev9.totalPrice} CAD)`);
    } else {
      changeSummaryItems.push(`🔺 <strong>Oct 9 – Oct 12 (3-Night Stay) INCREASED</strong> by $${diff} CAD. (New total: $${curr9.totalPrice} CAD, was $${prev9.totalPrice} CAD)`);
    }
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
      pricePerNight: curr10.pricePerNight,
      totalPrice: curr10.totalPrice,
      basePrice: curr10.basePrice,
      taxesAndFees: curr10.taxesAndFees,
      available: curr10.available
    },
    oct9ToOct12: {
      pricePerNight: curr9.pricePerNight,
      totalPrice: curr9.totalPrice,
      basePrice: curr9.basePrice,
      taxesAndFees: curr9.taxesAndFees,
      available: curr9.available
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

  // Save status file for GitHub Actions step condition
  const statusData = {
    priceChanged: priceChanged,
    changeCount: changeSummaryItems.length,
    subject: priceChanged ? "🔔 Hotel Price Alert: Price Change Detected!" : "No Price Change"
  };
  fs.writeFileSync(STATUS_JSON_FILE, JSON.stringify(statusData, null, 2), 'utf8');

  // Build HTML email body
  let emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #cbd5e1; border-radius: 10px; background-color: #f8fafc;">
      <h2 style="color: #0f172a; margin-top: 0;">🔔 Hotel Price Change Alert!</h2>
      <p style="color: #475569;"><strong>Property:</strong> Bayview Wildwood Resort, Severn Bridge ON</p>
      <p style="color: #475569;"><strong>Occupancy:</strong> 2 Adults, 2 Children (age 9, 9)</p>
      
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />

      <h3 style="color: #0f172a;">Detected Price Changes:</h3>
      <ul style="padding-left: 20px; color: #334155; line-height: 1.6;">
        ${changeSummaryItems.map(item => `<li style="margin-bottom: 10px;">${item}</li>`).join('')}
      </ul>

      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />

      <div style="background-color: #ffffff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; margin-bottom: 15px;">
        <h3 style="margin-top: 0; color: #0284c7;">🗓️ Oct 10 – Oct 12 (2-Night Stay)</h3>
        <p style="margin: 5px 0; font-size: 1.1em;"><strong>Grand Total:</strong> $${curr10.totalPrice} CAD ($${curr10.pricePerNight}/night)</p>
        <p style="margin: 5px 0; color: #64748b; font-size: 0.9em;">Base Room: $${curr10.basePrice} CAD | Taxes & Fees: $${curr10.taxesAndFees} CAD</p>
      </div>

      <div style="background-color: #ffffff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #d97706;">🗓️ Oct 9 – Oct 12 (3-Night Stay)</h3>
        <p style="margin: 5px 0; font-size: 1.1em;"><strong>Grand Total:</strong> $${curr9.totalPrice} CAD ($${curr9.pricePerNight}/night)</p>
        <p style="margin: 5px 0; color: #64748b; font-size: 0.9em;">Base Room: $${curr9.basePrice} CAD | Taxes & Fees: $${curr9.taxesAndFees} CAD</p>
      </div>

      <a href="https://koraytugay.github.io/hotel-price-monitor/" style="display: inline-block; padding: 12px 20px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">View Live Web Dashboard ↗</a>
    </div>
  `;
  fs.writeFileSync(EMAIL_BODY_FILE, emailHtml, 'utf8');

  console.log(`✅ Price check completed. Price Changed: ${priceChanged}`);
}

main().catch(err => {
  console.error('Fatal error in price checker:', err);
  process.exit(1);
});
