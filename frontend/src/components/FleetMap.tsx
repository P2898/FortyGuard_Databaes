import { useEffect, useRef } from "react";
import L from "leaflet";
import { Site, Assessment } from "../lib/api";
import { getRiskColor } from "./helpers";
import { addPegmanToMap } from "./PegmanControl";

export default function FleetMap({
  sites,
  assessments,
}: {
  sites: Site[];
  assessments: Assessment[];
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

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
    if (!m) return;

    // Remove existing site markers and circles (but NOT pegman markers)
    m.eachLayer((layer: any) => {
      if (layer instanceof L.Circle) {
        m.removeLayer(layer);
      }
      if (layer instanceof L.Marker && !(layer as any).__pegman) {
        m.removeLayer(layer);
      }
    });

    const iconCache: Record<string, L.DivIcon> = {};

    sites.forEach((s) => {
      const a = [...assessments].reverse().find((x) => x.site_id === s.site_id);
      const risk = a?.risk_bucket || "LOW";
      const temp = a?.temperature_c || 0;
      const color = getRiskColor(risk);

      // Create risk-colored marker with temperature label
      if (!iconCache[risk]) {
        iconCache[risk] = L.divIcon({
          className: "",
          html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:700;white-space:nowrap"></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
      }

      const markerIcon = L.divIcon({
        className: "",
        html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:700;white-space:nowrap">${Math.round(temp)}\u00b0</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      L.marker([s.latitude, s.longitude], { icon: markerIcon })
        .addTo(m)
        .bindPopup(
          `<div style="font-family:system-ui;min-width:160px">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px">${s.name}</div>
            <div style="color:#64748b;font-size:12px;margin-bottom:8px">${s.site_type.replace("_", " ")} \u00b7 ${s.site_id}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">
              <div><span style="color:#64748b">Risk:</span> <span style="color:${color};font-weight:600">${risk}</span></div>
              <div><span style="color:#64748b">Temp:</span> <span style="font-weight:600">${temp}\u00b0C</span></div>
              <div><span style="color:#64748b">Heat Idx:</span> <span style="font-weight:600">${a?.heat_index?.toFixed(1) || "\u2014"}</span></div>
              <div><span style="color:#64748b">Exceed:</span> <span style="font-weight:600">${a?.exceedance_hours?.toFixed(1) || "\u2014"}h</span></div>
            </div>
          </div>`
        );

      // Temperature circle overlay (semi-transparent)
      if (temp > 0) {
        const radius = 800 + (temp - 20) * 50; // Bigger circle for hotter temps
        L.circle([s.latitude, s.longitude], {
          radius,
          fillColor: color,
          fillOpacity: 0.12,
          color: color,
          weight: 1,
          opacity: 0.3,
        }).addTo(m);
      }

      // Heat ripple for CRITICAL/HIGH sites
      if (risk === "CRITICAL" || risk === "HIGH") {
        const rippleColor = risk === "CRITICAL" ? "#ef4444" : "#f97316";
        const rippleHtml = `
          <div style="position:relative;width:60px;height:60px;pointer-events:none">
            <div style="position:absolute;inset:0;border-radius:50%;border:2px solid ${rippleColor};opacity:0;animation:heatRipple 2s ease-out infinite"></div>
            <div style="position:absolute;inset:0;border-radius:50%;border:2px solid ${rippleColor};opacity:0;animation:heatRipple 2s ease-out 0.7s infinite"></div>
          </div>
        `;
        const rippleIcon = L.divIcon({
          className: "",
          html: rippleHtml,
          iconSize: [60, 60],
          iconAnchor: [30, 30],
        });
        L.marker([s.latitude, s.longitude], { icon: rippleIcon, interactive: false }).addTo(m);
      }
    });

    // Fit map to show all sites
    if (sites.length > 0) {
      const bounds = L.latLngBounds(sites.map((s) => [s.latitude, s.longitude]));
      m.fitBounds(bounds.pad(0.2));
    }
  }, [sites, assessments]);

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          height: "calc(100vh - 140px)",
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid #1e293b",
        }}
        ref={mapRef}
      />

      {/* Legend overlay */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          background: "#111827ee",
          borderRadius: 8,
          padding: "10px 14px",
          border: "1px solid #1e293b",
          zIndex: 1000,
          fontSize: 12,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6, color: "#e2e8f0" }}>Risk Level</div>
        {[
          ["CRITICAL", "#dc2626"],
          ["HIGH", "#ea580c"],
          ["MEDIUM", "#d97706"],
          ["LOW", "#16a34a"],
        ].map(([label, color]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: color,
                flexShrink: 0,
              }}
            />
            <span style={{ color: "#94a3b8" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Site count badge */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          background: "#111827ee",
          borderRadius: 8,
          padding: "6px 12px",
          border: "1px solid #1e293b",
          zIndex: 1000,
          fontSize: 12,
          color: "#94a3b8",
        }}
      >
        {sites.length} sites \u00b7 {assessments.length} assessments
      </div>
    </div>
  );
}
