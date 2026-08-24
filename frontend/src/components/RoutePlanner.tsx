import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import { planRoute, getRouteSites, RouteSite, RouteResult } from "../lib/api";
import { addPegmanToMap } from "./PegmanControl";

function tempToColor(tempC: number): string {
  if (tempC < 22) return "#22c55e";
  if (tempC < 27) return "#84cc16";
  if (tempC < 32) return "#eab308";
  if (tempC < 37) return "#f97316";
  return "#ef4444";
}

export default function RoutePlanner() {
  const [sites, setSites] = useState<RouteSite[]>([]);
  const [originId, setOriginId] = useState("");
  const [destId, setDestId] = useState("");
  const [travelMode, setTravelMode] = useState<"drive" | "walk">("drive");
  const [useGPS, setUseGPS] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);

  // Load sites
  useEffect(() => {
    getRouteSites().then(setSites).catch(console.error);
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const m = L.map(mapRef.current, { zoomControl: true }).setView([37.8, -122.0], 9);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "\u00a9 OpenStreetMap",
      maxZoom: 18,
    }).addTo(m);
    mapInstance.current = m;
    addPegmanToMap(m);
    return () => { m.remove(); mapInstance.current = null; };
  }, []);

  // Add site markers
  useEffect(() => {
    const m = mapInstance.current;
    if (!m || !sites.length) return;
    sites.forEach((s) => {
      const icon = L.divIcon({
        className: "",
        html: '<div style="width:12px;height:12px;border-radius:50%;background:#06b6d4;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      L.marker([s.latitude, s.longitude], { icon }).addTo(m).bindPopup(`<b>${s.name}</b><br>${s.site_id}`);
    });
  }, [sites]);

  const requestGPS = () => {
    setGpsLoading(true);
    if (!navigator.geolocation) {
      setError("Geolocation not supported by your browser");
      setGpsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGpsLoading(false);
        setError("");
      },
      (err) => {
        setError(`GPS error: ${err.message}`);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const clearRouteLayers = () => {
    const m = mapInstance.current;
    if (!m) return;
    layersRef.current.forEach((l) => m.removeLayer(l));
    layersRef.current = [];
  };

  const planRouteHandler = async () => {
    if (destId === "") {
      setError("Select a destination");
      return;
    }

    let originLat: number, originLon: number, originName: string;

    if (useGPS && gpsCoords) {
      originLat = gpsCoords.lat;
      originLon = gpsCoords.lon;
      originName = "My Location (GPS)";
    } else if (originId) {
      const origin = sites.find((s) => s.site_id === originId);
      if (!origin) { setError("Invalid origin"); return; }
      originLat = origin.latitude;
      originLon = origin.longitude;
      originName = origin.name;
    } else {
      setError("Select an origin or enable GPS");
      return;
    }

    const dest = sites.find((s) => s.site_id === destId);
    if (!dest) { setError("Invalid destination"); return; }
    if (originId === destId && !useGPS) { setError("Origin and destination must be different"); return; }

    setLoading(true);
    setError("");
    clearRouteLayers();

    try {
      const r = await planRoute({
        origin_lat: originLat,
        origin_lon: originLon,
        dest_lat: dest.latitude,
        dest_lon: dest.longitude,
        origin_name: originName,
        dest_name: dest.name,
        travel_mode: travelMode,
      });
      setResult(r);
      drawRoutes(r);
    } catch (e: any) {
      setError(e.message || "Failed to plan route");
    }
    setLoading(false);
  };

  const drawRoutes = (r: RouteResult) => {
    const m = mapInstance.current;
    if (!m) return;

    // Fastest route (blue, dashed)
    const fastestCoords: L.LatLngTuple[] = r.fastest_route.coordinates.map((c) => [c[1], c[0]]);
    const fastestLine = L.polyline(fastestCoords, { color: "#3b82f6", weight: 5, opacity: 0.7, dashArray: "8, 6" }).addTo(m);
    fastestLine.bindPopup(`<b>Fastest Route</b><br>Avg temp: ${r.fastest_route.avg_temp_c}\u00b0C`);
    layersRef.current.push(fastestLine);

    // Coolest route (heat-colored segments)
    const coolestCoords: L.LatLngTuple[] = r.coolest_route.coordinates.map((c) => [c[1], c[0]]);
    const segmentSize = 5;
    for (let i = 0; i < coolestCoords.length - 1; i += segmentSize) {
      const seg = coolestCoords.slice(i, Math.min(i + segmentSize + 1, coolestCoords.length));
      if (seg.length < 2) continue;
      const avgTemp = (r.fastest_route.avg_temp_c + r.coolest_route.avg_temp_c) / 2 + (i / coolestCoords.length - 0.5) * 4;
      const segLine = L.polyline(seg, { color: tempToColor(avgTemp), weight: 6, opacity: 0.9 }).addTo(m);
      layersRef.current.push(segLine);
    }

    // Start/end markers
    const startIcon = L.divIcon({
      className: "",
      html: '<div style="width:24px;height:24px;border-radius:50%;background:#22c55e;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:bold">A</div>',
      iconSize: [24, 24], iconAnchor: [12, 12],
    });
    const endIcon = L.divIcon({
      className: "",
      html: '<div style="width:24px;height:24px;border-radius:50%;background:#ef4444;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:bold">B</div>',
      iconSize: [24, 24], iconAnchor: [12, 12],
    });
    const startMarker = L.marker(fastestCoords[0], { icon: startIcon }).addTo(m).bindPopup(`<b>${r.origin.name}</b>`);
    const endMarker = L.marker(fastestCoords[fastestCoords.length - 1], { icon: endIcon }).addTo(m).bindPopup(`<b>${r.destination.name}</b>`);
    layersRef.current.push(startMarker, endMarker);

    m.fitBounds(L.latLngBounds([...fastestCoords, ...coolestCoords]).pad(0.15));
  };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700 }}>Route Planner</h2>
      <p style={{ color: "#94a3b8", marginTop: 2 }}>
        Compare fastest vs. heat-coolest route — powered by FortyGuard grid
      </p>

      {/* Origin / Destination / Mode */}
      <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        {/* Origin */}
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 4 }}>Origin</label>
          {useGPS ? (
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, padding: "10px 12px", border: "1px solid #334155", borderRadius: 8, background: "#0f172a", color: "#22c55e", fontSize: 14 }}>
                {gpsCoords ? `${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lon.toFixed(4)}` : "Waiting for GPS..."}
              </div>
              <button onClick={requestGPS} disabled={gpsLoading} style={{ padding: "10px 12px", background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0", cursor: "pointer", fontSize: 14 }}>
                {gpsLoading ? "..." : "\uD83D\uDCF7"}
              </button>
            </div>
          ) : (
            <select value={originId} onChange={(e) => setOriginId(e.target.value)} style={{ width: "100%", padding: "10px 12px", border: "1px solid #334155", borderRadius: 8, background: "#0f172a", color: "#e2e8f0", fontSize: 14 }}>
              <option value="">Select origin...</option>
              {sites.map((s) => (<option key={s.site_id} value={s.site_id}>{s.name}</option>))}
            </select>
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 12, color: "#94a3b8", cursor: "pointer" }}>
            <input type="checkbox" checked={useGPS} onChange={(e) => { setUseGPS(e.target.checked); if (e.target.checked) requestGPS(); }} style={{ accentColor: "#06b6d4" }} />
            Use my GPS location
          </label>
        </div>

        {/* Destination */}
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 4 }}>Destination</label>
          <select value={destId} onChange={(e) => setDestId(e.target.value)} style={{ width: "100%", padding: "10px 12px", border: "1px solid #334155", borderRadius: 8, background: "#0f172a", color: "#e2e8f0", fontSize: 14 }}>
            <option value="">Select destination...</option>
            {sites.map((s) => (<option key={s.site_id} value={s.site_id}>{s.name}</option>))}
          </select>
        </div>

        {/* Travel mode */}
        <div>
          <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 4 }}>Mode</label>
          <div style={{ display: "flex", border: "1px solid #334155", borderRadius: 8, overflow: "hidden" }}>
            {(["drive", "walk"] as const).map((mode) => (
              <button key={mode} onClick={() => setTravelMode(mode)} style={{ padding: "10px 14px", background: travelMode === mode ? "#06b6d4" : "#0f172a", color: travelMode === mode ? "#fff" : "#94a3b8", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                {mode === "drive" ? "\uD83D\uDE97 Drive" : "\uD83D\uDEB6 Walk"}
              </button>
            ))}
          </div>
        </div>

        {/* Plan button */}
        <button onClick={planRouteHandler} disabled={loading || !destId} style={{ padding: "10px 24px", background: loading || !destId ? "#334155" : "#06b6d4", color: "#fff", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
          {loading ? "Planning..." : "Plan Route"}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: "8px 14px", background: "#7f1d1d", color: "#fca5a5", borderRadius: 8, fontSize: 13 }}>{error}</div>
      )}

      {result && (
        <>
          {/* Headline stat */}
          <div style={{ display: "flex", gap: 16, marginTop: 20, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200, background: "linear-gradient(135deg, #064e3b, #065f46)", borderRadius: 12, padding: 20, border: "1px solid #059669" }}>
              <div style={{ fontSize: 13, color: "#6ee7b7" }}>Coolest route</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginTop: 4 }}>
                {result.temp_delta_f > 0 ? `${result.temp_delta_f.toFixed(1)}\u00b0F cooler` : "Same temperature"}
              </div>
              <div style={{ fontSize: 13, color: "#a7f3d0", marginTop: 4 }}>
                {result.time_delta_min > 0 ? `${result.time_delta_min} min longer` : "Same travel time"}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 140, background: "#111827", borderRadius: 12, padding: 16, border: "1px solid #1e293b" }}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Distance</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{result.distance_km} km</div>
            </div>
            <div style={{ flex: 1, minWidth: 140, background: "#111827", borderRadius: 12, padding: 16, border: "1px solid #1e293b" }}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Fastest avg</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: tempToColor(result.fastest_route.avg_temp_c) }}>{result.fastest_route.avg_temp_c}\u00b0C</div>
            </div>
            <div style={{ flex: 1, minWidth: 140, background: "#111827", borderRadius: 12, padding: 16, border: "1px solid #1e293b" }}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Coolest avg</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: tempToColor(result.coolest_route.avg_temp_c) }}>{result.coolest_route.avg_temp_c}\u00b0C</div>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12, color: "#94a3b8" }}>
            <span><span style={{ display: "inline-block", width: 20, height: 3, background: "#3b82f6", marginRight: 4, verticalAlign: "middle" }}></span> Fastest route</span>
            <span><span style={{ display: "inline-block", width: 20, height: 3, background: "linear-gradient(90deg, #22c55e, #eab308, #ef4444)", marginRight: 4, verticalAlign: "middle" }}></span> Coolest route (heat-colored)</span>
            <span style={{ color: "#64748b" }}>Mode: {travelMode === "drive" ? "Driving" : "Walking"}</span>
          </div>
        </>
      )}

      <div style={{ height: "calc(100vh - 400px)", minHeight: 350, borderRadius: 12, overflow: "hidden", border: "1px solid #1e293b", marginTop: 16 }} ref={mapRef} />
    </div>
  );
}
