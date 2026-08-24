import L from "leaflet";

/**
 * PegmanControl — Google Maps-style draggable pegman for Leaflet.
 *
 * Adds an orange person icon in the bottom-right corner of the map.
 * When dragged and dropped onto the map, it:
 * 1. Places a pegman marker at the drop location
 * 2. Fetches FortyGuard heat data for that point
 * 3. Opens a popup with temperature, heat index, humidity, solar + Mapillary link
 */

const PEGMAN_SVG = `
<svg viewBox="0 0 28 44" width="28" height="44">
  <!-- Shadow -->
  <ellipse cx="14" cy="42" rx="8" ry="2.5" fill="rgba(0,0,0,0.25)"/>
  <!-- Head -->
  <circle cx="14" cy="10" r="7.5" fill="#F2994A" stroke="#D97706" stroke-width="0.8"/>
  <!-- Eyes -->
  <circle cx="11" cy="9.5" r="1.3" fill="#fff" opacity="0.9"/>
  <circle cx="17" cy="9.5" r="1.3" fill="#fff" opacity="0.9"/>
  <circle cx="11.3" cy="9.7" r="0.6" fill="#1a1a2e"/>
  <circle cx="17.3" cy="9.7" r="0.6" fill="#1a1a2e"/>
  <!-- Body -->
  <path d="M8 18 Q14 15.5 20 18 L18.5 34 Q14 36.5 9.5 34 Z" fill="#F2994A" stroke="#D97706" stroke-width="0.8"/>
  <!-- Hi-vis stripe -->
  <rect x="9.5" y="21" width="9" height="1.8" rx="0.9" fill="#FDE68A" opacity="0.8"/>
  <!-- Arms -->
  <path d="M5 21 Q7.5 27 12 24.5" stroke="#F2994A" stroke-width="3.5" stroke-linecap="round" fill="none"/>
  <path d="M23 21 Q20.5 27 16 24.5" stroke="#F2994A" stroke-width="3.5" stroke-linecap="round" fill="none"/>
  <!-- Legs -->
  <rect x="10" y="34" width="3.5" height="6" rx="1.75" fill="#D97706"/>
  <rect x="14.5" y="34" width="3.5" height="6" rx="1.75" fill="#D97706"/>
  <!-- Boots -->
  <rect x="9" y="39" width="5" height="3" rx="1.5" fill="#78350f"/>
  <rect x="14" y="39" width="5" height="3" rx="1.5" fill="#78350f"/>
</svg>`;

const PEGMAN_MARKER_SVG = `
<svg viewBox="0 0 28 48" width="32" height="52" style="filter:drop-shadow(0 3px 6px rgba(0,0,0,0.5))">
  <!-- Pin body -->
  <path d="M14 46 C14 46 2 28 2 16 A12 12 0 0 1 26 16 C26 28 14 46 14 46Z" fill="#F2994A" stroke="#D97706" stroke-width="1"/>
  <!-- Inner circle -->
  <circle cx="14" cy="16" r="10" fill="#FEF3C7" stroke="#F2994A" stroke-width="1"/>
  <!-- Person inside circle -->
  <circle cx="14" cy="12" r="4" fill="#D97706"/>
  <path d="M9 18 Q14 16 19 18 L17.5 26 Q14 27.5 10.5 26 Z" fill="#D97706"/>
  <path d="M7 19.5 Q9 23 12 21.5" stroke="#D97706" stroke-width="2" stroke-linecap="round" fill="none"/>
  <path d="M21 19.5 Q19 23 16 21.5" stroke="#D97706" stroke-width="2" stroke-linecap="round" fill="none"/>
</svg>`;

function tempColor(tempC: number): string {
  if (tempC < 22) return "#22c55e";
  if (tempC < 27) return "#84cc16";
  if (tempC < 32) return "#eab308";
  if (tempC < 37) return "#f97316";
  return "#ef4444";
}

function tempColorLabel(tempC: number): string {
  if (tempC < 22) return "Cool";
  if (tempC < 27) return "Mild";
  if (tempC < 32) return "Warm";
  if (tempC < 37) return "Hot";
  return "Extreme";
}

async function fetchHeatData(
  lat: number,
  lng: number
): Promise<{
  temperature_c: number;
  heat_index_c: number;
  humidity: number;
  solar_irradiance: number;
  aqi: number;
} | null> {
  try {
    const base = window.location.origin.includes("localhost")
      ? "http://localhost:8000"
      : "";
    const resp = await fetch(
      `${base}/api/streetview/heat-data?lat=${lat.toFixed(6)}&lon=${lng.toFixed(6)}`
    );
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

function buildPopupHTML(
  lat: number,
  lng: number,
  data: {
    temperature_c: number;
    heat_index_c: number;
    humidity: number;
    solar_irradiance: number;
    aqi: number;
  } | null
): string {
  const mapillaryUrl = `https://www.mapillary.com/app/?lat=${lat}&lng=${lng}&z=15`;
  const copyText = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

  if (!data) {
    return `
      <div style="min-width:290px;font-family:system-ui,-apple-system,sans-serif;padding:4px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #e2e8f0">
          ${PEGMAN_SVG.replace(/width="28" height="44"/, 'width="20" height="30"')}
          <div>
            <div style="font-size:13px;font-weight:700;color:#1a1a2e">Street View Inspector</div>
            <div style="font-size:11px;color:#6b7280">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
          </div>
        </div>
        <div style="text-align:center;padding:12px;color:#6b7280;font-size:13px">
          Could not load heat data for this location.
        </div>
        <a href="${mapillaryUrl}" target="_blank" rel="noopener"
           style="display:block;text-align:center;padding:8px;background:#0ea5e9;color:#fff;border-radius:8px;text-decoration:none;font-size:12px;font-weight:600">
          🗺️ View Street Level on Mapillary
        </a>
      </div>`;
  }

  const tc = tempColor(data.temperature_c);
  const hc = tempColor(data.heat_index_c);
  const label = tempColorLabel(data.temperature_c);

  return `
    <div style="min-width:290px;font-family:system-ui,-apple-system,sans-serif;padding:4px">
      <!-- Header -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #e2e8f0">
        ${PEGMAN_SVG.replace(/width="28" height="44"/, 'width="22" height="32"')}
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;color:#1a1a2e">Street View Inspector</div>
          <div style="font-size:11px;color:#6b7280">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
        </div>
        <span style="padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600;background:${tc}22;color:${tc};border:1px solid ${tc}44">${label}</span>
      </div>

      <!-- Heat data grid -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
        <div style="background:#f8fafc;padding:10px;border-radius:8px;border:1px solid #e2e8f0">
          <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Temperature</div>
          <div style="font-size:20px;font-weight:800;color:${tc};margin-top:2px">${data.temperature_c.toFixed(1)}°C</div>
          <div style="font-size:11px;color:#9ca3af">${((data.temperature_c * 9) / 5 + 32).toFixed(1)}°F · 2m height</div>
        </div>
        <div style="background:#f8fafc;padding:10px;border-radius:8px;border:1px solid #e2e8f0">
          <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Heat Index</div>
          <div style="font-size:20px;font-weight:800;color:${hc};margin-top:2px">${data.heat_index_c.toFixed(1)}°C</div>
          <div style="font-size:11px;color:#9ca3af">${((data.heat_index_c * 9) / 5 + 32).toFixed(1)}°F · NIOSH source</div>
        </div>
        <div style="background:#f8fafc;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0">
          <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Humidity</div>
          <div style="font-size:16px;font-weight:700;color:#1a1a2e;margin-top:2px">${data.humidity}%</div>
        </div>
        <div style="background:#f8fafc;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0">
          <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Solar Irradiance</div>
          <div style="font-size:16px;font-weight:700;color:#1a1a2e;margin-top:2px">${data.solar_irradiance} W/m²</div>
        </div>
      </div>

      <!-- AQI bar -->
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
          <span style="color:#6b7280">Air Quality Index</span>
          <span style="font-weight:600;color:#1a1a2e">${data.aqi}</span>
        </div>
        <div style="height:4px;background:#e5e7eb;border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${Math.min(data.aqi / 150, 1) * 100}%;background:${data.aqi < 50 ? "#22c55e" : data.aqi < 100 ? "#eab308" : "#ef4444"};border-radius:2px"></div>
        </div>
      </div>

      <!-- Source badge -->
      <div style="font-size:10px;color:#9ca3af;margin-bottom:10px;text-align:center">
        Powered by FortyGuard · 20m resolution · 2m human-height data
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:6px">
        <a href="${mapillaryUrl}" target="_blank" rel="noopener"
           style="flex:1;display:block;text-align:center;padding:8px 12px;background:#0ea5e9;color:#fff;border-radius:8px;text-decoration:none;font-size:12px;font-weight:600">
          🗺️ Street View
        </a>
        <button onclick="navigator.clipboard.writeText('${copyText}').then(()=>this.textContent='✓ Copied')"
                style="padding:8px 12px;background:#f1f5f9;color:#374151;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;font-size:12px;font-weight:500">
          📋 Copy
        </button>
      </div>
    </div>`;
}

/**
 * Add a draggable pegman control to a Leaflet map.
 * Drop the pegman anywhere on the map to inspect street-level heat data.
 */
export function addPegmanToMap(map: L.Map): void {
  // 1. Create the pegman control
  const PegmanControl = L.Control.extend({
    options: { position: "bottomright" as const },

    onAdd: function () {
      const container = L.DomUtil.create("div", "leaflet-pegman-control");
      container.innerHTML = `<div class="pegman-icon" draggable="true" title="Drag to map — inspect heat data at any point">${PEGMAN_SVG}</div>`;

      const pegmanEl = container.querySelector(".pegman-icon") as HTMLElement;

      pegmanEl.addEventListener("dragstart", (e: DragEvent) => {
        e.dataTransfer!.setData("text/plain", "pegman");
        e.dataTransfer!.effectAllowed = "copy";
        // Create a transparent drag image so the default ghost doesn't show
        const ghost = document.createElement("div");
        ghost.style.opacity = "0";
        document.body.appendChild(ghost);
        e.dataTransfer!.setDragImage(ghost, 0, 0);
        setTimeout(() => document.body.removeChild(ghost), 0);
        map.getContainer().classList.add("pegman-dragging");
      });

      pegmanEl.addEventListener("dragend", () => {
        map.getContainer().classList.remove("pegman-dragging");
      });

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);
      return container;
    },
  });

  new PegmanControl().addTo(map);

  // 2. Drop handler on the map container
  const mapContainer = map.getContainer();
  let currentPopupMarker: L.Marker | null = null;

  mapContainer.addEventListener("dragover", (e: DragEvent) => {
    if (!mapContainer.classList.contains("pegman-dragging")) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = "copy";
  });

  mapContainer.addEventListener("drop", async (e: DragEvent) => {
    if (!mapContainer.classList.contains("pegman-dragging")) return;
    e.preventDefault();
    mapContainer.classList.remove("pegman-dragging");

    // Convert screen coords to map coords
    const rect = mapContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const latlng = map.containerPointToLatLng(L.point(x, y));

    // Remove previous pegman marker
    if (currentPopupMarker) {
      map.removeLayer(currentPopupMarker);
      currentPopupMarker = null;
    }

    // Place pegman marker with pin style
    const markerIcon = L.divIcon({
      className: "pegman-marker",
      html: PEGMAN_MARKER_SVG,
      iconSize: [32, 52],
      iconAnchor: [16, 48],
      popupAnchor: [0, -48],
    });

    const marker = L.marker([latlng.lat, latlng.lng], { icon: markerIcon })
      .addTo(map)
      .bindPopup(
        `<div style="min-width:290px;font-family:system-ui;text-align:center;padding:20px">
          <div style="font-size:13px;color:#6b7280">Loading heat data...</div>
          <div style="margin-top:8px;font-size:11px;color:#9ca3af">📍 ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}</div>
        </div>`,
        { maxWidth: 360, minWidth: 300 }
      )
      .openPopup();

    currentPopupMarker = marker;

    // Fetch heat data and update popup
    const data = await fetchHeatData(latlng.lat, latlng.lng);
    if (marker === currentPopupMarker) {
      marker.setPopupContent(buildPopupHTML(latlng.lat, latlng.lng, data));
    }
  });

  // 3. Click on map also works as fallback (place pegman on click)
  map.on("click", async (e: L.LeafletMouseEvent) => {
    // Only if Shift+Click (to not interfere with normal map clicks)
    if (!e.originalEvent.shiftKey) return;

    const { lat, lng } = e.latlng;

    if (currentPopupMarker) {
      map.removeLayer(currentPopupMarker);
      currentPopupMarker = null;
    }

    const markerIcon = L.divIcon({
      className: "pegman-marker",
      html: PEGMAN_MARKER_SVG,
      iconSize: [32, 52],
      iconAnchor: [16, 48],
      popupAnchor: [0, -48],
    });

    const marker = L.marker([lat, lng], { icon: markerIcon })
      .addTo(map)
      .bindPopup(
        `<div style="min-width:290px;font-family:system-ui;text-align:center;padding:20px">
          <div style="font-size:13px;color:#6b7280">Loading heat data...</div>
        </div>`,
        { maxWidth: 360, minWidth: 300 }
      )
      .openPopup();

    currentPopupMarker = marker;

    const data = await fetchHeatData(lat, lng);
    if (marker === currentPopupMarker) {
      marker.setPopupContent(buildPopupHTML(lat, lng, data));
    }
  });
}
