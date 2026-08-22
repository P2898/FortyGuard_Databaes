import { useEffect, useRef } from "react";
import L from "leaflet";
import { Site, Assessment } from "../lib/api";
import { getRiskColor } from "./helpers";

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
    const m = L.map(mapRef.current).setView([37.8, -122.2], 9);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "\u00a9 OpenStreetMap",
    }).addTo(m);
    mapInstance.current = m;
  }, []);

  useEffect(() => {
    const m = mapInstance.current;
    if (!m) return;
    m.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) m.removeLayer(layer);
    });
    const iconCache: Record<string, L.DivIcon> = {};
    sites.forEach((s) => {
      const a = [...assessments]
        .reverse()
        .find((x) => x.site_id === s.site_id);
      const risk = a?.risk_bucket || "LOW";
      if (!iconCache[risk]) {
        const color = getRiskColor(risk);
        iconCache[risk] = L.divIcon({
          className: "",
          html:
            '<div style="width:20px;height:20px;border-radius:50%;background:' +
            color +
            ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
      }
      L.marker([s.latitude, s.longitude], { icon: iconCache[risk] })
        .addTo(m)
        .bindPopup(
          "<b>" +
            s.name +
            "</b><br>" +
            s.site_type +
            "<br>Risk: " +
            risk +
            "<br>" +
            (a?.temperature_c?.toFixed(1) || "\u2014") +
            "\u00b0C"
        );
    });
  }, [sites, assessments]);

  return (
    <div
      style={{
        height: "calc(100vh - 140px)",
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid #1e293b",
      }}
      ref={mapRef}
    />
  );
}
