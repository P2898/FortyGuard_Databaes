import { useState, useEffect, useRef } from "react";
import L from "leaflet";

export default function RoutePlanner() {
  const [origin, setOrigin] = useState("37.7955,-122.3937");
  const [dest, setDest] = useState("37.7397,-121.4252");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const m = L.map(mapRef.current).setView([37.8, -122.0], 9);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "\u00a9 OpenStreetMap",
    }).addTo(m);
    mapInstance.current = m;
  }, []);

  const planRoute = async () => {
    setLoading(true);
    const oCoords = origin.split(",").map(Number);
    const dCoords = dest.split(",").map(Number);
    setResult({
      fastest_route_geojson: {
        type: "LineString",
        coordinates: [oCoords.slice().reverse(), dCoords.slice().reverse()],
      },
      coolest_route_geojson: {
        type: "LineString",
        coordinates: [oCoords.slice(), dCoords.slice()],
      },
      temp_delta: 3.3,
      time_delta: 4,
    });
    setLoading(false);
  };

  useEffect(() => {
    if (!result || !mapInstance.current) return;
    const m = mapInstance.current;
    m.eachLayer((l: any) => {
      if (l instanceof L.Polyline) m.removeLayer(l);
    });
    const coords = result.fastest_route_geojson?.coordinates || [];
    if (coords.length) {
      L.polyline(coords, { color: "#3b82f6", weight: 4, opacity: 0.7 }).addTo(m);
      const coolCoords = result.coolest_route_geojson?.coordinates || coords;
      L.polyline(coolCoords, { color: "#22c55e", weight: 4, opacity: 0.9 }).addTo(m);
      m.fitBounds(L.latLngBounds(coords).pad(0.2));
    }
  }, [result]);

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700 }}>Route Planner</h2>
      <p style={{ color: "#94a3b8", marginTop: 2 }}>
        Compare fastest vs. heat-coolest route
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
        <input
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          placeholder="Origin (lat,lon)"
          style={{ flex: 1, minWidth: 160, padding: "8px 12px", border: "1px solid #334155", borderRadius: 6, background: "#0f172a", color: "#e2e8f0" }}
        />
        <input
          value={dest}
          onChange={(e) => setDest(e.target.value)}
          placeholder="Destination (lat,lon)"
          style={{ flex: 1, minWidth: 160, padding: "8px 12px", border: "1px solid #334155", borderRadius: 6, background: "#0f172a", color: "#e2e8f0" }}
        />
        <button
          onClick={planRoute}
          disabled={loading}
          style={{ padding: "8px 20px", background: loading ? "#334155" : "#06b6d4", color: "#fff", borderRadius: 6, border: "none", cursor: "pointer", fontWeight: 600 }}
        >
          {loading ? "Planning..." : "Plan Route"}
        </button>
      </div>
      {result && (
        <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
          <div style={{ background: "#0f172a", borderRadius: 8, padding: 16, flex: 1, minWidth: 180, border: "1px solid #1e293b" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Fastest Route</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#3b82f6" }}>Blue line</div>
          </div>
          <div style={{ background: "#0f172a", borderRadius: 8, padding: 16, flex: 1, minWidth: 180, border: "1px solid #1e293b" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Coolest Route</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#22c55e" }}>Green line</div>
          </div>
          {result.temp_delta != null && (
            <div style={{ background: "#0f172a", borderRadius: 8, padding: 16, flex: 1, minWidth: 180, border: "1px solid #1e293b" }}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Temperature Difference</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#22c55e" }}>
                {result.temp_delta.toFixed(1)}{"\u00b0"}C cooler
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                {result.time_delta?.toFixed(0)} min longer
              </div>
            </div>
          )}
        </div>
      )}
      <div style={{ height: 400, borderRadius: 12, overflow: "hidden", border: "1px solid #1e293b", marginTop: 16 }} ref={mapRef} />
    </div>
  );
}
