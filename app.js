(function () {
  const STORAGE_KEY = 'weatherPinMap.pins';
  const weatherCache = {}; // key: "lat,lng_days" -> { data } | { error }

  let pins = loadPins();
  let markers = {}; // pin id -> leaflet marker
  const daysSelect = document.getElementById('daysSelect');
  let selectedDays = parseInt(daysSelect.value, 10);

  const map = L.map('map').setView([51.1657, 10.4515], 6); // centered on Germany
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  map.on('click', (e) => addPin(e.latlng.lat, e.latlng.lng));

  daysSelect.addEventListener('change', (e) => {
    selectedDays = parseInt(e.target.value, 10);
    renderTable();
    Object.values(markers).forEach((marker) => {
      if (marker.isPopupOpen()) openPinPopup(marker._pinId, marker);
    });
  });

  document.getElementById('clearAllBtn').addEventListener('click', () => {
    if (pins.length === 0) return;
    if (!confirm('Remove all saved pins? This cannot be undone.')) return;
    pins = [];
    savePins();
    Object.values(markers).forEach((m) => map.removeLayer(m));
    markers = {};
    renderTable();
  });

  function loadPins() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('Failed to read pins from localStorage', err);
      return [];
    }
  }

  function savePins() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
    } catch (err) {
      console.error('Failed to save pins to localStorage', err);
    }
  }

  function nextPinName() {
    const existing = new Set(pins.map((p) => p.name));
    let n = pins.length + 1;
    while (existing.has(`Pin ${n}`)) n++;
    return `Pin ${n}`;
  }

  function addPin(lat, lng) {
    const pin = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      lat,
      lng,
      name: nextPinName(),
      createdAt: new Date().toISOString()
    };
    pins.push(pin);
    savePins();
    addMarker(pin);
    renderTable();
  }

  function removePin(id) {
    pins = pins.filter((p) => p.id !== id);
    savePins();
    if (markers[id]) {
      map.removeLayer(markers[id]);
      delete markers[id];
    }
    renderTable();
  }

  function renamePin(id, newName) {
    const pin = pins.find((p) => p.id === id);
    if (!pin || !newName) return;
    pin.name = newName;
    savePins();
  }

  function addMarker(pin) {
    const marker = L.marker([pin.lat, pin.lng]).addTo(map);
    marker._pinId = pin.id;
    marker.bindPopup(buildLoadingPopupHtml(pin), { maxWidth: 260 });
    marker.on('popupopen', () => openPinPopup(pin.id, marker));
    markers[pin.id] = marker;
    return marker;
  }

  function buildLoadingPopupHtml(pin) {
    return `<div class="popup"><strong>${escapeHtml(pin.name)}</strong><br>Loading weather…</div>`;
  }

  async function openPinPopup(id, marker) {
    const pin = pins.find((p) => p.id === id);
    if (!pin) return;
    marker.setPopupContent(buildLoadingPopupHtml(pin));
    const result = await getWeather(pin.lat, pin.lng, selectedDays);
    if (!marker.isPopupOpen()) return;
    marker.setPopupContent(buildWeatherPopupHtml(pin, result));
  }

  function buildWeatherPopupHtml(pin, result) {
    if (result.error) {
      return `<div class="popup"><strong>${escapeHtml(pin.name)}</strong><br>` +
        `<span class="error">Couldn't load weather: ${escapeHtml(result.error)}</span></div>`;
    }
    const { totalRain, rainyDays, daily } = result.data;
    const rows = daily
      .map((d) => `<tr><td>${d.date}</td><td>${d.rain.toFixed(1)} mm</td></tr>`)
      .join('');
    return `
      <div class="popup">
        <strong>${escapeHtml(pin.name)}</strong>
        <div class="popup-summary">Last ${selectedDays} days: <b>${totalRain.toFixed(1)} mm</b> total, ${rainyDays} rainy day${rainyDays === 1 ? '' : 's'}</div>
        <div class="popup-table-wrap">
          <table class="popup-table">
            <thead><tr><th>Date</th><th>Rain</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  async function getWeather(lat, lng, days) {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}_${days}`;
    if (weatherCache[key]) return weatherCache[key];
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
        `&daily=precipitation_sum&past_days=${days}&forecast_days=1&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const dates = json.daily.time;
      const rains = json.daily.precipitation_sum;
      // past_days=N + forecast_days=1 returns N past days plus today; drop today, keep the N past days.
      const daily = dates.slice(0, days).map((date, i) => ({ date, rain: rains[i] ?? 0 }));
      const totalRain = daily.reduce((sum, d) => sum + d.rain, 0);
      const rainyDays = daily.filter((d) => d.rain > 0.1).length;
      const result = { data: { totalRain, rainyDays, daily } };
      weatherCache[key] = result;
      return result;
    } catch (err) {
      return { error: err.message || String(err) };
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderTable() {
    const tbody = document.getElementById('pinsTableBody');
    const emptyState = document.getElementById('emptyState');
    const table = document.getElementById('pinsTable');
    tbody.innerHTML = '';

    if (pins.length === 0) {
      emptyState.style.display = 'block';
      table.style.display = 'none';
      return;
    }
    emptyState.style.display = 'none';
    table.style.display = 'table';

    pins.forEach((pin) => {
      const tr = document.createElement('tr');

      const nameTd = document.createElement('td');
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = pin.name;
      nameInput.className = 'name-input';
      nameInput.addEventListener('change', (e) => renamePin(pin.id, e.target.value.trim()));
      nameTd.appendChild(nameInput);

      const latTd = document.createElement('td');
      latTd.textContent = pin.lat.toFixed(5);

      const lngTd = document.createElement('td');
      lngTd.textContent = pin.lng.toFixed(5);

      const rainTd = document.createElement('td');
      rainTd.textContent = '…';

      const rainyTd = document.createElement('td');
      rainyTd.textContent = '…';

      const actionsTd = document.createElement('td');
      actionsTd.className = 'actions';

      const showBtn = document.createElement('button');
      showBtn.type = 'button';
      showBtn.textContent = 'Show on map';
      showBtn.addEventListener('click', () => {
        map.setView([pin.lat, pin.lng], Math.max(map.getZoom(), 10));
        const marker = markers[pin.id];
        if (marker) marker.openPopup();
      });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = 'Remove';
      removeBtn.className = 'danger';
      removeBtn.addEventListener('click', () => removePin(pin.id));

      actionsTd.appendChild(showBtn);
      actionsTd.appendChild(removeBtn);

      tr.appendChild(nameTd);
      tr.appendChild(latTd);
      tr.appendChild(lngTd);
      tr.appendChild(rainTd);
      tr.appendChild(rainyTd);
      tr.appendChild(actionsTd);
      tbody.appendChild(tr);

      getWeather(pin.lat, pin.lng, selectedDays).then((result) => {
        if (result.error) {
          rainTd.textContent = 'N/A';
          rainyTd.textContent = 'N/A';
          rainTd.title = result.error;
        } else {
          rainTd.textContent = `${result.data.totalRain.toFixed(1)} mm`;
          rainyTd.textContent = String(result.data.rainyDays);
        }
      });
    });
  }

  // init
  pins.forEach(addMarker);
  renderTable();
})();
