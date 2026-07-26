document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('./data/prices.json?t=' + Date.now());
    if (!response.ok) {
      throw new Error(`Failed to load pricing data (HTTP ${response.status})`);
    }
    const data = await response.json();
    renderDashboard(data);
  } catch (error) {
    console.error('Error fetching prices data:', error);
    showErrorState(error.message);
  }
});

function renderDashboard(data) {
  // 1. Meta Details
  const lastUpdatedEl = document.getElementById('last-updated');
  if (lastUpdatedEl && data.lastUpdated) {
    const formattedDate = new Date(data.lastUpdated).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
    lastUpdatedEl.textContent = formattedDate;
  }

  const occupancyEl = document.getElementById('occupancy-info');
  if (occupancyEl && data.occupancy) {
    const { adults, children, childAges } = data.occupancy;
    occupancyEl.textContent = `${adults} Adults, ${children} Children (ages ${childAges.join(', ')})`;
  }

  // 2. Render Cards
  const curr = data.current || {};
  if (curr.oct10ToOct12) {
    renderCard('card-oct10-12', curr.oct10ToOct12);
  }
  if (curr.oct9ToOct12) {
    renderCard('card-oct9-12', curr.oct9ToOct12);
  }

  // 3. Render Historical Chart
  if (data.history && data.history.length > 0) {
    renderChart(data.history);
  }
}

function renderCard(cardId, item) {
  const card = document.getElementById(cardId);
  if (!card) return;

  const priceEl = card.querySelector('.price-val');
  const nightPriceEl = card.querySelector('.night-val');
  const totalValEl = card.querySelector('.total-val');
  const bookingBtn = card.querySelector('.btn-book');

  if (priceEl) priceEl.textContent = `$${item.pricePerNight}`;
  if (nightPriceEl) nightPriceEl.textContent = `$${item.pricePerNight} CAD`;
  if (totalValEl) totalValEl.textContent = `$${item.totalPrice} ${item.currency}`;
  if (bookingBtn && item.bookingUrl) {
    bookingBtn.href = item.bookingUrl;
  }
}

function renderChart(history) {
  const ctx = document.getElementById('priceHistoryChart');
  if (!ctx) return;

  const labels = history.map(h => h.dateLabel || new Date(h.timestamp).toLocaleDateString());
  const datasetOct10 = history.map(h => h.oct10ToOct12 ? h.oct10ToOct12.pricePerNight : null);
  const datasetOct9 = history.map(h => h.oct9ToOct12 ? h.oct9ToOct12.pricePerNight : null);

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Oct 10 – Oct 12 (2 Nights)',
          data: datasetOct10,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.15)',
          borderWidth: 3,
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6
        },
        {
          label: 'Oct 9 – Oct 12 (3 Nights)',
          data: datasetOct9,
          borderColor: '#fbbf24',
          backgroundColor: 'rgba(251, 191, 36, 0.15)',
          borderWidth: 3,
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6
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
            font: { family: 'Outfit', size: 13 }
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: $${context.raw} CAD/night`;
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
  const container = document.querySelector('.pricing-grid');
  if (container) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #f87171; padding: 40px; background: rgba(239, 68, 68, 0.1); border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.2);">
      <h3>Unable to load current prices</h3>
      <p style="margin-top: 8px;">${msg}</p>
    </div>`;
  }
}
