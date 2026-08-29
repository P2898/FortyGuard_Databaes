import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import { planRoute, getRouteSites, RouteSite, RouteResult } from "../lib/api";
import { getUserPegmanSvg } from "./PegmanControl";
import { addPegmanToMap } from "./PegmanControl";
import { useTheme } from "../lib/theme";

function tempToColor(tempC: number): string {
  if (tempC < 22) return "#22c55e";
  if (tempC < 27) return "#84cc16";
  if (tempC < 32) return "#eab308";
  if (tempC < 37) return "#f97316";
  return "#ef4444";
}

interface RoutePlannerProps {
  initialOriginId?: string;
  initialDestId?: string;
  onRoutePlanned?: () => void;
}

export default function RoutePlanner({ initialOriginId, initialDestId, onRoutePlanned }: RoutePlannerProps = {}) {
  const { colors } = useTheme();
  const [sites, setSites] = useState<RouteSite[]>([]);
  const [originId, setOriginId] = useState("");
  const [destId, setDestId] = useState("");
  const [travelMode, setTravelMode] = useState<"drive" | "walk" | "ride">("drive");
  const [useGPS, setUseGPS] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);

  // Avatar settings are read from localStorage by getUserPegmanSvg()

  const autoPlanDone = useRef(false);
  useEffect(() => {
    getRouteSites().then((s) => {
      setSites(s);
      if (initialOriginId && initialDestId && !autoPlanDone.current) {
        autoPlanDone.current = true;
        setOriginId(initialOriginId);
        setDestId(initialDestId);
      }
    }).catch(console.error);
  }, [initialOriginId, initialDestId]);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const m = L.map(mapRef.current, { zoomControl: true }).setView([37.8, -122.0], 9);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "\u00a9 OpenStreetMap",
      maxZoom: 18,
    }).addTo(m);
    mapInstance.current = m;
    const cleanupPegman = addPegmanToMap(m);
    return () => {
      cleanupPegman?.();
      m.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    const m = mapInstance.current;
    if (!m || !sites.length) return;
    sites.forEach((s) => {
      const icon = L.divIcon({
        className: "",
        html: '<div style="width:12px;height:12px;border-radius:50%;background:#c07a28;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      L.marker([s.latitude, s.longitude], { icon }).addTo(m).bindPopup(`<b>${s.name}</b><br>${s.site_id}`);
    });
  }, [sites]);

  const lastAutoPlanKey = useRef("");
  useEffect(() => {
    if (sites.length > 0 && originId && destId && initialOriginId && initialDestId) {
      const key = `${initialOriginId}-${initialDestId}`;
      if (key !== lastAutoPlanKey.current && !result && !loading) {
        lastAutoPlanKey.current = key;
        planRouteHandler();
      }
    }
  }, [sites, originId, destId, initialOriginId, initialDestId]);

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
      onRoutePlanned?.();
    } catch (e: any) {
      setError(e.message || "Failed to plan route");
    }
    setLoading(false);
  };

  const drawRoutes = (r: RouteResult) => {
    const m = mapInstance.current;
    if (!m) return;
    const fastestCoords: L.LatLngTuple[] = r.fastest_route.coordinates.map((c) => [c[1], c[0]]);
    const fastestLine = L.polyline(fastestCoords, { color: "#3b82f6", weight: 5, opacity: 0.7, dashArray: "8, 6" }).addTo(m);
    fastestLine.bindPopup(`<b>Fastest Route</b><br>Avg temp: ${r.fastest_route.avg_temp_c}°C`);
    layersRef.current.push(fastestLine);
    const coolestCoords: L.LatLngTuple[] = r.coolest_route.coordinates.map((c) => [c[1], c[0]]);
    const segmentSize = 5;
    for (let i = 0; i < coolestCoords.length - 1; i += segmentSize) {
      const seg = coolestCoords.slice(i, Math.min(i + segmentSize + 1, coolestCoords.length));
      if (seg.length < 2) continue;
      const avgTemp = (r.fastest_route.avg_temp_c + r.coolest_route.avg_temp_c) / 2 + (i / coolestCoords.length - 0.5) * 4;
      const segLine = L.polyline(seg, { color: tempToColor(avgTemp), weight: 6, opacity: 0.9 }).addTo(m);
      layersRef.current.push(segLine);
    }
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
    if (initialOriginId) {
      // Use avatar settings from localStorage
      const PEGMAN_SVG = getUserPegmanSvg(32, 48);
      const pegmanIcon = L.divIcon({
        className: "pegman-marker",
        html: PEGMAN_SVG,
        iconSize: [32, 48],
        iconAnchor: [16, 44],
      });
      const pegmanMarker = L.marker(fastestCoords[0], { icon: pegmanIcon }).addTo(m);
      pegmanMarker.bindPopup(
        `<div style="font-family:system-ui;min-width:160px;text-align:center">
          <div style="font-size:12px;color:#64748b;margin-bottom:4px">Your starting point</div>
          <div style="font-weight:700;font-size:14px">${r.origin.name}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:4px">Drag the pegman to any point for street view</div>
        </div>`
      );
      layersRef.current.push(pegmanMarker);
    }
    m.fitBounds(L.latLngBounds([...fastestCoords, ...coolestCoords]).pad(0.15));
  };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.text }}>Route Planner</h2>
      <p style={{ color: colors.textSecondary, marginTop: 2 }}>
        Compare fastest vs. heat-coolest route — powered by FortyGuard grid
      </p>

      {/* Main form row — all controls on the same line */}
      <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={{ fontSize: 12, color: colors.textSecondary, display: "block", marginBottom: 4 }}>Origin</label>
          {useGPS ? (
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, padding: "10px 12px", border: `1px solid ${colors.borderLight}`, borderRadius: 8, background: colors.bg, color: "#22c55e", fontSize: 14 }}>
                {gpsCoords ? `${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lon.toFixed(4)}` : "Waiting for GPS..."}
              </div>
              <button onClick={requestGPS} disabled={gpsLoading} style={{ padding: "10px 12px", background: colors.surfaceHover, border: `1px solid ${colors.borderLight}`, borderRadius: 8, color: colors.text, cursor: "pointer", fontSize: 14 }}>
                {gpsLoading ? "..." : "📷"}
              </button>
            </div>
          ) : (
            <select value={originId} onChange={(e) => setOriginId(e.target.value)} style={{ width: "100%", padding: "10px 12px", border: `1px solid ${colors.borderLight}`, borderRadius: 8, background: colors.bg, color: colors.text, fontSize: 14 }}>
              <option value="">Select origin...</option>
              {sites.map((s) => (<option key={s.site_id} value={s.site_id}>{s.name}</option>))}
            </select>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={{ fontSize: 12, color: colors.textSecondary, display: "block", marginBottom: 4 }}>Destination</label>
          <select value={destId} onChange={(e) => setDestId(e.target.value)} style={{ width: "100%", padding: "10px 12px", border: `1px solid ${colors.borderLight}`, borderRadius: 8, background: colors.bg, color: colors.text, fontSize: 14 }}>
            <option value="">Select destination...</option>
            {sites.map((s) => (<option key={s.site_id} value={s.site_id}>{s.name}</option>))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 12, color: colors.textSecondary, display: "block", marginBottom: 4 }}>Mode</label>
          <div style={{ display: "flex", border: `1px solid ${colors.borderLight}`, borderRadius: 8, overflow: "hidden" }}>
            {(["drive", "walk", "ride"] as const).map((mode) => (
              <button key={mode} onClick={() => setTravelMode(mode)} style={{ padding: "10px 14px", background: travelMode === mode ? colors.accent : colors.bg, color: travelMode === mode ? "#fff" : colors.textSecondary, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                {mode === "drive" ? "🚗 Drive" : mode === "walk" ? "🚶 Walk" : "🚴 Ride"}
              </button>
            ))}
          </div>
        </div>

        <button onClick={planRouteHandler} disabled={loading || !destId} style={{ padding: "10px 24px", background: loading || !destId ? colors.borderLight : colors.accent, color: "#fff", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, height: 40 }}>
          {loading ? "Planning..." : "Plan Route"}
        </button>
      </div>

      {/* GPS checkbox — below the form row */}
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12, color: colors.textSecondary, cursor: "pointer" }}>
        <input type="checkbox" checked={useGPS} onChange={(e) => { setUseGPS(e.target.checked); if (e.target.checked) requestGPS(); }} style={{ accentColor: colors.accent }} />
        Use my GPS location
      </label>

      {error && (
        <div style={{ marginTop: 12, padding: "8px 14px", background: "#7f1d1d", color: "#fca5a5", borderRadius: 8, fontSize: 13 }}>{error}</div>
      )}

      {result && (
        <>
          <div style={{ display: "flex", gap: 16, marginTop: 20, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200, background: "linear-gradient(135deg, #064e3b, #065f46)", borderRadius: 12, padding: 20, border: "1px solid #059669" }}>
              <div style={{ fontSize: 13, color: "#6ee7b7" }}>Coolest route</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginTop: 4 }}>
                {result.temp_delta_f > 0 ? `${result.temp_delta_c.toFixed(1)}°C / ${result.temp_delta_f.toFixed(1)}°F cooler` : "Same temperature"}
              </div>
              <div style={{ fontSize: 13, color: "#a7f3d0", marginTop: 4 }}>
                {result.time_delta_min > 0 ? `${result.time_delta_min} min longer` : "Same travel time"}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 140, background: colors.surface, borderRadius: 12, padding: 16, border: `1px solid ${colors.border}` }}>
              <div style={{ fontSize: 12, color: colors.textMuted }}>Distance</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: colors.text }}>{result.distance_km} km</div>
            </div>
            <div style={{ flex: 1, minWidth: 140, background: colors.surface, borderRadius: 12, padding: 16, border: `1px solid ${colors.border}` }}>
              <div style={{ fontSize: 12, color: colors.textMuted }}>Fastest avg</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: tempToColor(result.fastest_route.avg_temp_c) }}>{result.fastest_route.avg_temp_c}°C / {((result.fastest_route.avg_temp_c * 9) / 5 + 32).toFixed(1)}°F</div>
            </div>
            <div style={{ flex: 1, minWidth: 140, background: colors.surface, borderRadius: 12, padding: 16, border: `1px solid ${colors.border}` }}>
              <div style={{ fontSize: 12, color: colors.textMuted }}>Coolest avg</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: tempToColor(result.coolest_route.avg_temp_c) }}>{result.coolest_route.avg_temp_c}°C / {((result.coolest_route.avg_temp_c * 9) / 5 + 32).toFixed(1)}°F</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12, color: colors.textSecondary }}>
            <span><span style={{ display: "inline-block", width: 20, height: 3, background: "#3b82f6", marginRight: 4, verticalAlign: "middle" }}></span> Fastest route</span>
            <span><span style={{ display: "inline-block", width: 20, height: 3, background: "linear-gradient(90deg, #22c55e, #eab308, #ef4444)", marginRight: 4, verticalAlign: "middle" }}></span> Coolest route (heat-colored)</span>
            <span style={{ color: colors.textMuted }}>Mode: {travelMode === "drive" ? "Driving" : travelMode === "ride" ? "Cycling" : "Walking"}</span>
          </div>
        </>
      )}

      <div style={{ height: "calc(100vh - 400px)", minHeight: 350, borderRadius: 12, overflow: "hidden", border: `1px solid ${colors.border}`, marginTop: 16 }} ref={mapRef} />
    </div>
  );
}
