document.addEventListener('DOMContentLoaded', async () => {
  try {
    let data = window.PRICES_DATA;

    if (!data) {
      const response = await fetch('./data/prices.json?t=' + Date.now());
      if (!response.ok) {
        throw new Error(`Failed to load pricing data (HTTP ${response.status})`);
      }
      data = await response.json();
    }

    if (data) {
      renderDashboard(data);
    } else {
      throw new Error('No pricing data found.');
    }
  } catch (error) {
    console.error('Error loading price data:', error);
    showErrorState(error.message);
  }
});

function renderDashboard(data) {
  // 1. Meta Info
  const lastUpdatedEl = document.getElementById('last-updated');
  if (lastUpdatedEl && data.lastUpdated) {
    const formattedDate = new Date(data.lastUpdated).toLocaleString('en-US', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
    lastUpdatedEl.textContent = formattedDate;
  }

  const occupancyEl = document.getElementById('occupancy-info');
  if (occupancyEl && data.occupancy) {
    const { adults, children, childAges } = data.occupancy;
    occupancyEl.textContent = `${adults} Adults, ${children} Children (ages ${childAges.join(', ')})`;
  }

  // Normalize properties object
  const props = data.properties || {
    bayview: {
      id: 'bayview',
      name: 'Bayview Wildwood Resort, an Ascend Collection Resort',
      shortName: 'Bayview Wildwood Resort',
      location: 'Severn Bridge, Ontario',
      bookingUrl: 'https://www.choicehotels.com/ontario/severn-bridge/ascend-hotels/cnb64',
      rates: data.current || {}
    }
  };

  const bayviewRates = (props.bayview && props.bayview.rates) ? props.bayview.rates : (data.current || {});
  const grandRates = (props.grandTappattoo && props.grandTappattoo.rates) ? props.grandTappattoo.rates : {};

  // 2. Render Cards
  if (bayviewRates.oct10ToOct12) renderCard('card-bayview-oct10-12', bayviewRates.oct10ToOct12);
  if (bayviewRates.oct9ToOct12) renderCard('card-bayview-oct9-12', bayviewRates.oct9ToOct12);

  if (grandRates.oct10ToOct12) renderCard('card-grandTappattoo-oct10-12', grandRates.oct10ToOct12);
  if (grandRates.oct9ToOct12) renderCard('card-grandTappattoo-oct9-12', grandRates.oct9ToOct12);

  // 3. Highlight Best Deals
  highlightCheapest(bayviewRates, grandRates);

  // 4. Setup Filter Buttons
  setupFilters();

  // 5. Render Historical Chart
  if (data.history && data.history.length > 0) {
    renderChart(data.history);
  }
}

function renderCard(cardId, item) {
  const card = document.getElementById(cardId);
  if (!card) return;

  const priceWrapper = card.querySelector('.price-display-wrapper');
  const bookingBtn = card.querySelector('.btn-book');

  if (item.available === false) {
    card.classList.add('sold-out-card');
    if (priceWrapper) {
      priceWrapper.innerHTML = `
        <div class="sold-out-badge" style="color: #ef4444; font-size: 1.5rem; font-weight: 800; background: rgba(239, 68, 68, 0.1); padding: 10px; border-radius: 8px; text-align: center; border: 1px solid rgba(239, 68, 68, 0.3);">
          🚫 Sold Out
        </div>
        <div class="price-unit" style="text-align: center; margin-top: 8px; color: #fca5a5;">No available rooms for these dates</div>
      `;
    }
    if (bookingBtn) {
      bookingBtn.href = item.bookingUrl || '#';
      bookingBtn.innerHTML = `<span>Check Dates on ChoiceHotels</span> <span>↗</span>`;
      bookingBtn.style.background = 'linear-gradient(135deg, #475569 0%, #334155 100%)';
    }
  } else {
    card.classList.remove('sold-out-card');
    if (priceWrapper) {
      priceWrapper.innerHTML = `
        <div class="price-amount">
          <span class="currency">$</span><span class="price-val">${item.pricePerNight}</span>
        </div>
        <div class="price-unit">all-inclusive / night (${item.currency}) • <strong style="color: #38bdf8;">${item.roomType || 'Family Room'}</strong></div>
      `;
    }
    
    const detailsHtml = `
      <div class="price-breakdown">
        <span class="label">Base Room Rate (${item.nights} Nights):</span>
        <span class="value">$${item.basePrice} ${item.currency}</span>
      </div>
      <div class="price-breakdown">
        <span class="label">Taxes & Fees (HST + Resort Fee):</span>
        <span class="value" style="color: #fbbf24;">+$${item.taxesAndFees} ${item.currency}</span>
      </div>
      <div class="price-breakdown" style="border-top: 1px solid rgba(255,255,255,0.15); padding-top: 10px; margin-top: 10px;">
        <span class="label" style="font-weight: 700; color: #fff;">Total Stay Estimate:</span>
        <span class="value" style="font-weight: 800; font-size: 1.15rem; color: #34d399;">$${item.totalPrice} ${item.currency}</span>
      </div>
    `;

    const existingBreakdowns = card.querySelectorAll('.price-breakdown-wrapper');
    existingBreakdowns.forEach(el => el.remove());

    const breakdownWrapper = document.createElement('div');
    breakdownWrapper.className = 'price-breakdown-wrapper';
    breakdownWrapper.innerHTML = detailsHtml;

    if (bookingBtn) {
      card.insertBefore(breakdownWrapper, bookingBtn);
      bookingBtn.href = item.bookingUrl;
      bookingBtn.innerHTML = `<span>Book on Booking.com for $${item.totalPrice} CAD</span> <span>↗</span>`;
    }
  }
}

function highlightCheapest(bayviewRates, grandRates) {
  // 2-Night Stay comparison
  const b10 = bayviewRates.oct10ToOct12 ? bayviewRates.oct10ToOct12.totalPrice : null;
  const g10 = grandRates.oct10ToOct12 ? grandRates.oct10ToOct12.totalPrice : null;
  const best2NightEl = document.getElementById('best-2night');

  if (b10 && g10) {
    if (g10 < b10) {
      tagCard('card-grandTappattoo-oct10-12', '🏆 Lowest 2-Night Rate');
      if (best2NightEl) best2NightEl.querySelector('.highlight-value').innerHTML = `The Grand Tappattoo Resort ($${g10} CAD total) — Save $${b10 - g10} CAD!`;
    } else if (b10 < g10) {
      tagCard('card-bayview-oct10-12', '🏆 Lowest 2-Night Rate');
      if (best2NightEl) best2NightEl.querySelector('.highlight-value').innerHTML = `Bayview Wildwood Resort ($${b10} CAD total) — Save $${g10 - b10} CAD!`;
    } else {
      if (best2NightEl) best2NightEl.querySelector('.highlight-value').textContent = `Both resorts equal at $${b10} CAD total`;
    }
  } else if (b10 || g10) {
    const winner = b10 ? `Bayview Wildwood ($${b10} CAD)` : `Grand Tappattoo ($${g10} CAD)`;
    if (best2NightEl) best2NightEl.querySelector('.highlight-value').textContent = winner;
  }

  // 3-Night Stay comparison
  const b9 = bayviewRates.oct9ToOct12 ? bayviewRates.oct9ToOct12.totalPrice : null;
  const g9 = grandRates.oct9ToOct12 ? grandRates.oct9ToOct12.totalPrice : null;
  const best3NightEl = document.getElementById('best-3night');

  if (b9 && g9) {
    if (g9 < b9) {
      tagCard('card-grandTappattoo-oct9-12', '🏆 Lowest 3-Night Rate');
      if (best3NightEl) best3NightEl.querySelector('.highlight-value').innerHTML = `The Grand Tappattoo Resort ($${g9} CAD total) — Save $${b9 - g9} CAD!`;
    } else if (b9 < g9) {
      tagCard('card-bayview-oct9-12', '🏆 Lowest 3-Night Rate');
      if (best3NightEl) best3NightEl.querySelector('.highlight-value').innerHTML = `Bayview Wildwood Resort ($${b9} CAD total) — Save $${g9 - b9} CAD!`;
    } else {
      if (best3NightEl) best3NightEl.querySelector('.highlight-value').textContent = `Both resorts equal at $${b9} CAD total`;
    }
  } else if (b9 || g9) {
    const winner = b9 ? `Bayview Wildwood ($${b9} CAD)` : `Grand Tappattoo ($${g9} CAD)`;
    if (best3NightEl) best3NightEl.querySelector('.highlight-value').textContent = winner;
  }
}

function tagCard(cardId, label) {
  const card = document.getElementById(cardId);
  if (!card) return;
  card.classList.add('best-deal');
  const tag = document.createElement('div');
  tag.className = 'best-deal-tag';
  tag.textContent = label;
  card.appendChild(tag);
}

function setupFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.getAttribute('data-resort-filter');
      const bayviewSec = document.getElementById('resort-bayview');
      const grandSec = document.getElementById('resort-grandTappattoo');

      if (filter === 'all') {
        if (bayviewSec) bayviewSec.classList.remove('hidden');
        if (grandSec) grandSec.classList.remove('hidden');
      } else if (filter === 'bayview') {
        if (bayviewSec) bayviewSec.classList.remove('hidden');
        if (grandSec) grandSec.classList.add('hidden');
      } else if (filter === 'grandTappattoo') {
        if (bayviewSec) bayviewSec.classList.add('hidden');
        if (grandSec) grandSec.classList.remove('hidden');
      }
    });
  });
}

function renderChart(history) {
  const ctx = document.getElementById('priceHistoryChart');
  if (!ctx) return;

  const uniqueMap = new Map();
  history.forEach(entry => {
    const label = entry.dateLabel || new Date(entry.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    uniqueMap.set(label, entry);
  });

  const uniqueHistory = Array.from(uniqueMap.values());
  const labels = Array.from(uniqueMap.keys());

  // Extract datasets for both resorts
  const b10Data = uniqueHistory.map(h => {
    const r = (h.bayview && h.bayview.oct10ToOct12) || h.oct10ToOct12;
    return r ? (r.totalPrice || r.pricePerNight) : null;
  });

  const b9Data = uniqueHistory.map(h => {
    const r = (h.bayview && h.bayview.oct9ToOct12) || h.oct9ToOct12;
    return r ? (r.totalPrice || r.pricePerNight) : null;
  });

  const g10Data = uniqueHistory.map(h => {
    const r = h.grandTappattoo ? h.grandTappattoo.oct10ToOct12 : null;
    return r ? (r.totalPrice || r.pricePerNight) : null;
  });

  const g9Data = uniqueHistory.map(h => {
    const r = h.grandTappattoo ? h.grandTappattoo.oct9ToOct12 : null;
    return r ? (r.totalPrice || r.pricePerNight) : null;
  });

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Bayview Wildwood (Oct 10–12, 2N)',
          data: b10Data,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.1)',
          borderWidth: 3,
          tension: 0.3,
          pointRadius: 5
        },
        {
          label: 'Bayview Wildwood (Oct 9–12, 3N)',
          data: b9Data,
          borderColor: '#0284c7',
          backgroundColor: 'rgba(2, 132, 199, 0.1)',
          borderWidth: 3,
          tension: 0.3,
          pointRadius: 5
        },
        {
          label: 'Grand Tappattoo (Oct 10–12, 2N)',
          data: g10Data,
          borderColor: '#fbbf24',
          backgroundColor: 'rgba(251, 191, 36, 0.1)',
          borderWidth: 3,
          tension: 0.3,
          pointRadius: 5
        },
        {
          label: 'Grand Tappattoo (Oct 9–12, 3N)',
          data: g9Data,
          borderColor: '#a855f7',
          backgroundColor: 'rgba(168, 85, 247, 0.1)',
          borderWidth: 3,
          tension: 0.3,
          pointRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#f8fafc',
            font: { family: 'Outfit', size: 12 }
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              return context.raw ? `${context.dataset.label}: $${context.raw} CAD Total` : `${context.dataset.label}: N/A`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#94a3b8',
            font: { family: 'Outfit' },
            callback: value => '$' + value
          }
        }
      }
    }
  });
}

function showErrorState(msg) {
  const container = document.querySelector('main');
  if (container) {
    container.innerHTML = `<div style="text-align: center; color: #f87171; padding: 40px; background: rgba(239, 68, 68, 0.1); border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.2);">
      <h3>Unable to load current prices</h3>
      <p style="margin-top: 8px;">${msg}</p>
    </div>`;
  }
}
