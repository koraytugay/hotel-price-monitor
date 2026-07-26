const fs = require('fs');
const path = require('path');

const DATA_JSON_FILE = path.join(__dirname, '../data/prices.json');
const DATA_JS_FILE = path.join(__dirname, '../data/prices.js');
const STATUS_JSON_FILE = path.join(__dirname, '../data/price_status.json');
const EMAIL_BODY_FILE = path.join(__dirname, '../data/email_body.html');

const PROPERTIES = [
  {
    id: 'bayview',
    name: 'Bayview Wildwood Resort, an Ascend Collection Resort',
    shortName: 'Bayview Wildwood Resort',
    location: 'Severn Bridge, Ontario, Canada',
    searchQuery: 'Bayview+Wildwood+Resort',
    matchKeywords: ['bayview wildwood', 'bayview'],
    roomType: 'Queen Room with Two Queen Beds (2 Adults, 2 Children)',
    taxRate: 0.25
  },
  {
    id: 'grandTappattoo',
    name: 'The Grand Tappattoo Resort, an Ascend Collection Resort',
    shortName: 'The Grand Tappattoo Resort',
    location: 'Seguin, Ontario, Canada',
    searchQuery: 'The+Grand+Tappattoo+Resort',
    matchKeywords: ['grand tappattoo', 'tappattoo'],
    roomType: 'Family Suite / Lakefront Room (2 Adults, 2 Children)',
    taxRate: 0.13
  }
];

// Target Date Ranges for 2 Adults + 2 Kids (aged 9, 9)
const TARGET_RANGES = [
  { 
    key: 'oct10ToOct12', 
    label: 'Oct 10 – Oct 12',
    nightsLabel: '2-Night Weekend Stay',
    checkIn: '2026-10-10', 
    checkOut: '2026-10-12', 
    nights: 2
  },
  { 
    key: 'oct9ToOct12', 
    label: 'Oct 9 – Oct 12',
    nightsLabel: '3-Night Extended Stay',
    checkIn: '2026-10-09', 
    checkOut: '2026-10-12', 
    nights: 3
  }
];

async function fetchRatesForPropertyAndRange(property, range) {
  const searchUrl = `https://www.booking.com/searchresults.html?ss=${property.searchQuery}&checkin=${range.checkIn}&checkout=${range.checkOut}&group_adults=2&group_children=2&age=9&age=9`;
  
  console.log(`Checking live rates for ${property.shortName} (${range.checkIn} to ${range.checkOut}, ${range.nights} nights)...`);

  let basePrice = null;
  let taxesAndFees = null;
  let totalPrice = null;
  let pricePerNight = null;
  let currency = 'CAD';
  let isAvailable = false;
  let statusMessage = 'Checking...';
  let provider = 'Booking.com / Hotel Direct';
  let detailBookingUrl = searchUrl;

  try {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 },
      locale: 'en-CA',
      timezoneId: 'America/Toronto'
    });
    const page = await context.newPage();

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(3000);

    const propertyCards = await page.locator('[data-testid="property-card"]').all().catch(() => []);
    let detailHref = '';

    for (const card of propertyCards) {
      const title = await card.locator('[data-testid="title"]').innerText().catch(() => '');
      const isMatch = property.matchKeywords.some(k => title.toLowerCase().includes(k));
      if (isMatch) {
        detailHref = await card.locator('a[data-testid="title-link"]').getAttribute('href').catch(() => '');
        break;
      }
    }

    if (detailHref) {
      const fullDetailUrl = detailHref.startsWith('http') ? detailHref : `https://www.booking.com${detailHref}`;
      detailBookingUrl = fullDetailUrl;

      await page.goto(fullDetailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(4000);

      // Scrape room table rows matching 2 adults + 2 children occupancy
      const roomRows = await page.locator('tbody tr, .hprt-table-row').all().catch(() => []);

      for (const row of roomRows) {
        const text = await row.innerText().catch(() => '');
        const lowerText = text.toLowerCase();
        
        // Match room row that accommodates 4 guests / 2 adults 2 children
        const is2Adults2Kids = lowerText.includes('2 adults, 2 children') || lowerText.includes('two queen') || lowerText.includes('2 queen') || lowerText.includes('family') || lowerText.includes('cottage');
        
        if (is2Adults2Kids) {
          const priceText = await row.locator('.hprt-price-price, .bui-price-display__value, .prco-val-bui-wrapper').innerText().catch(() => '');
          const clean = priceText.replace(/[^\d]/g, '');

          if (clean) {
            const val = parseFloat(clean);
            if (val >= 400 && val < 5000) {
              basePrice = val;

              // Extract explicit taxes & fees from row text if present
              const taxMatch = text.match(/\+CAD\s*(\d+)/i) || text.match(/\+(\d+)\s*taxes/i);
              if (taxMatch) {
                taxesAndFees = parseFloat(taxMatch[1]);
              } else {
                taxesAndFees = Math.round(basePrice * property.taxRate);
              }

              totalPrice = basePrice + taxesAndFees;
              pricePerNight = Math.round((totalPrice / range.nights) * 100) / 100;
              isAvailable = true;
              statusMessage = 'Available';
              console.log(`  -> Dynamically extracted room rate for ${property.shortName} (${range.label}): CAD $${basePrice} base + $${taxesAndFees} tax = $${totalPrice} total ($${pricePerNight}/night)`);
              break;
            }
          }
        }
      }

      // Fallback if specific room text search didn't catch: grab first valid room table price >= 400
      if (!basePrice && roomRows.length > 0) {
        for (const row of roomRows) {
          const text = await row.innerText().catch(() => '');
          const priceText = await row.locator('.hprt-price-price, .bui-price-display__value, .prco-val-bui-wrapper').innerText().catch(() => '');
          const clean = priceText.replace(/[^\d]/g, '');
          if (clean) {
            const val = parseFloat(clean);
            if (val >= 400) {
              basePrice = val;
              const taxMatch = text.match(/\+CAD\s*(\d+)/i) || text.match(/\+(\d+)\s*taxes/i);
              if (taxMatch) {
                taxesAndFees = parseFloat(taxMatch[1]);
              } else {
                taxesAndFees = Math.round(basePrice * property.taxRate);
              }
              totalPrice = basePrice + taxesAndFees;
              pricePerNight = Math.round((totalPrice / range.nights) * 100) / 100;
              isAvailable = true;
              statusMessage = 'Available';
              console.log(`  -> Fallback room table rate for ${property.shortName}: CAD $${basePrice} base + $${taxesAndFees} tax = $${totalPrice} total`);
              break;
            }
          }
        }
      }
    }

    await browser.close();
  } catch (err) {
    console.warn(`Booking.com price check notice for ${property.shortName} (${range.checkIn}): ${err.message}`);
  }

  if (!isAvailable) {
    statusMessage = 'Sold Out / Unavailable';
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
    roomType: property.roomType,
    available: isAvailable,
    statusMessage: statusMessage,
    bookingUrl: detailBookingUrl
  };
}

async function main() {
  console.log(`=== Starting Multi-Resort Price & Availability Change Checker ===`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  let existingData = {
    occupancy: { adults: 2, children: 2, childAges: [9, 9] },
    lastUpdated: new Date().toISOString(),
    properties: {},
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

  const prevProperties = existingData.properties || {};
  const currentResults = {};
  let priceChanged = false;
  let changeSummaryItems = [];

  for (const prop of PROPERTIES) {
    currentResults[prop.id] = {
      id: prop.id,
      name: prop.name,
      shortName: prop.shortName,
      location: prop.location,
      rates: {}
    };

    const prevRates = prevProperties[prop.id] ? (prevProperties[prop.id].rates || {}) : {};

    for (const range of TARGET_RANGES) {
      const fetchedRate = await fetchRatesForPropertyAndRange(prop, range);
      currentResults[prop.id].rates[range.key] = fetchedRate;

      const prevRate = prevRates[range.key];
      if (prevRate && prevRate.totalPrice && fetchedRate.totalPrice && prevRate.totalPrice !== fetchedRate.totalPrice) {
        priceChanged = true;
        const diff = fetchedRate.totalPrice - prevRate.totalPrice;
        if (diff < 0) {
          changeSummaryItems.push(`🟢 <strong>${prop.shortName} (${range.label}) DECREASED</strong> by $${Math.abs(diff)} CAD! (New total: $${fetchedRate.totalPrice} CAD, was $${prevRate.totalPrice} CAD)`);
        } else {
          changeSummaryItems.push(`🔺 <strong>${prop.shortName} (${range.label}) INCREASED</strong> by $${diff} CAD. (New total: $${fetchedRate.totalPrice} CAD, was $${prevRate.totalPrice} CAD)`);
        }
      }
    }
  }

  const nowIso = new Date().toISOString();
  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  existingData.lastUpdated = nowIso;
  existingData.properties = currentResults;

  if (currentResults.bayview) {
    existingData.property = currentResults.bayview.name;
    existingData.location = currentResults.bayview.location;
    existingData.current = currentResults.bayview.rates;
  }

  if (!existingData.history) {
    existingData.history = [];
  }

  const newHistoryRecord = {
    timestamp: nowIso,
    dateLabel: dateLabel,
    bayview: {
      oct10ToOct12: currentResults.bayview ? currentResults.bayview.rates.oct10ToOct12 : null,
      oct9ToOct12: currentResults.bayview ? currentResults.bayview.rates.oct9ToOct12 : null
    },
    grandTappattoo: {
      oct10ToOct12: currentResults.grandTappattoo ? currentResults.grandTappattoo.rates.oct10ToOct12 : null,
      oct9ToOct12: currentResults.grandTappattoo ? currentResults.grandTappattoo.rates.oct9ToOct12 : null
    },
    oct10ToOct12: currentResults.bayview ? currentResults.bayview.rates.oct10ToOct12 : null,
    oct9ToOct12: currentResults.bayview ? currentResults.bayview.rates.oct9ToOct12 : null
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

  const statusData = {
    priceChanged: priceChanged,
    changeCount: changeSummaryItems.length,
    subject: priceChanged ? "🔔 Hotel Price Alert: Rate Change Detected!" : "No Price Change"
  };
  fs.writeFileSync(STATUS_JSON_FILE, JSON.stringify(statusData, null, 2), 'utf8');

  let emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; padding: 20px; border: 1px solid #cbd5e1; border-radius: 10px; background-color: #f8fafc;">
      <h2 style="color: #0f172a; margin-top: 0;">🔔 Ascend Collection Resorts Price Alert!</h2>
      <p style="color: #475569;"><strong>Properties Monitored:</strong><br>
      • Bayview Wildwood Resort (Severn Bridge, ON)<br>
      • The Grand Tappattoo Resort (Seguin, ON)</p>
      <p style="color: #475569;"><strong>Occupancy:</strong> 2 Adults, 2 Children (age 9, 9)</p>
      
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />

      <h3 style="color: #0f172a;">Detected Price Changes:</h3>
      ${changeSummaryItems.length > 0 ? `<ul style="padding-left: 20px; color: #334155; line-height: 1.6;">${changeSummaryItems.map(item => `<li style="margin-bottom: 10px;">${item}</li>`).join('')}</ul>` : '<p style="color: #64748b;">No price changes detected since previous run.</p>'}

      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />

      <h3 style="color: #0f172a; margin-bottom: 15px;">Current Rate Summary:</h3>

      ${PROPERTIES.map(prop => {
        const rates = currentResults[prop.id] ? currentResults[prop.id].rates : {};
        const r10 = rates.oct10ToOct12 || {};
        const r9 = rates.oct9ToOct12 || {};
        return `
          <div style="background-color: #ffffff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; margin-bottom: 15px;">
            <h4 style="margin-top: 0; margin-bottom: 8px; color: #0284c7; font-size: 1.1em;">🏨 ${prop.name}</h4>
            <p style="margin: 3px 0; color: #64748b; font-size: 0.85em;">📍 ${prop.location}</p>
            
            <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #e2e8f0;">
              <p style="margin: 3px 0;"><strong>🗓️ Oct 10 – Oct 12 (2 Nights):</strong> $${r10.totalPrice} CAD ($${r10.pricePerNight}/night)</p>
              <p style="margin: 3px 0;"><strong>🗓️ Oct 9 – Oct 12 (3 Nights):</strong> $${r9.totalPrice} CAD ($${r9.pricePerNight}/night)</p>
            </div>
          </div>
        `;
      }).join('')}

      <a href="https://koraytugay.github.io/hotel-price-monitor/" style="display: inline-block; margin-top: 10px; padding: 12px 20px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">View Live Web Dashboard ↗</a>
    </div>
  `;
  fs.writeFileSync(EMAIL_BODY_FILE, emailHtml, 'utf8');

  console.log(`✅ Multi-resort price check completed. Price Changed: ${priceChanged}`);
}

main().catch(err => {
  console.error('Fatal error in price checker:', err);
  process.exit(1);
});
