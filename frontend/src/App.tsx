import { useState, useEffect, useCallback } from "react";
import {
  getSites,
  assessFleet,
  getHeatPL,
  getPolicy,
  updatePolicy,
  Site,
  Assessment,
  HeatPL,
  Policy,
} from "./lib/api";
import FleetDashboard from "./components/FleetDashboard";
import FleetMap from "./components/FleetMap";
import SiteDetail from "./components/SiteDetail";
import RoutePlanner from "./components/RoutePlanner";
import HeatPLScreen from "./components/HeatPLScreen";
import ReportsScreen from "./components/ReportsScreen";
import KelvinPanel from "./components/KelvinPanel";
import SettingsScreen from "./components/SettingsScreen";
import UploadScreen from "./components/UploadScreen";

type View =
  | "dashboard"
  | "map"
  | "site"
  | "route"
  | "heatpl"
  | "reports"
  | "kelvin"
  | "settings"
  | "setup";

const NAV_ITEMS: [View, string, string][] = [
  ["dashboard", "\uD83D\uDCCA", "Dashboard"],
  ["map", "\uD83D\uDDFA", "Map"],
  ["route", "\uD83D\uDEE3", "Routes"],
  ["heatpl", "\uD83D\uDCB0", "Heat P&L"],
  ["reports", "\uD83D\uDCC4", "Reports"],
  ["kelvin", "\uD83E\uDD16", "Kelvin"],
  ["settings", "\u2699", "Settings"],
];

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [sites, setSites] = useState<Site[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [heatPL, setHeatPL] = useState<HeatPL | null>(null);
  const [policy, setPolicy] = useState<Policy>({
    hazard_pay_rate_per_hr: 25,
    wage_rate_per_hr: 35,
    contract_day_rate: 5000,
  });
  const [selectedSite, setSelectedSite] = useState("");
  const [refreshTime, setRefreshTime] = useState("");
  const [refreshMs, setRefreshMs] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadSites = useCallback(async () => {
    try {
      const s = await getSites();
      setSites(s);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const refreshAssessments = useCallback(async () => {
    if (!sites.length) return;
    setRefreshing(true);
    const start = Date.now();
    try {
      const r = await assessFleet({});
      setAssessments(r.sites);
      setRefreshMs(Date.now() - start);
      setRefreshTime(new Date().toLocaleTimeString());
    } catch (e) {
      console.error(e);
    }
    setRefreshing(false);
  }, [sites]);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  useEffect(() => {
    if (sites.length) refreshAssessments();
  }, [sites, refreshAssessments]);

  useEffect(() => {
    getHeatPL()
      .then(setHeatPL)
      .catch(() => {});
    getPolicy()
      .then(setPolicy)
      .catch(() => {});
  }, []);

  const selectSite = (id: string) => {
    setSelectedSite(id);
    setView("site");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0f1a" }}>
      {/* Sidebar - desktop */}
      <nav
        style={{
          width: 220,
          background: "#111827",
          borderRight: "1px solid #1e293b",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
        className="sidebar-desktop"
      >
        <div style={{ padding: "20px 16px", borderBottom: "1px solid #1e293b" }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5, color: "#e2e8f0" }}>
            {"\uD83C\uDF21"} Shade
          </h1>
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            FortyGuard-powered safety
          </p>
        </div>
        <div style={{ flex: 1, padding: "8px" }}>
          {NAV_ITEMS.map(([v, icon, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "10px 12px",
                marginBottom: 2,
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: view === v ? 600 : 400,
                background: view === v ? "#1e293b" : "transparent",
                color: view === v ? "#06b6d4" : "#94a3b8",
                textAlign: "left",
              }}
            >
              <span>{icon}</span> {label}
            </button>
          ))}
        </div>
        <div style={{ padding: "12px 8px", borderTop: "1px solid #1e293b" }}>
          <button
            onClick={() => setView("setup")}
            style={{
              width: "100%",
              padding: "8px",
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              color: "#94a3b8",
            }}
          >
            {"\u2699"} Site Setup
          </button>
        </div>
      </nav>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 24px",
            borderBottom: "1px solid #1e293b",
            background: "#111827",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {refreshTime && (
              <span
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  background: "#1e293b",
                  padding: "4px 10px",
                  borderRadius: 12,
                }}
              >
                Last refresh: {refreshTime} ({refreshMs}ms{" "}
                <span style={{ color: "#22c55e" }}>cached</span>)
              </span>
            )}
          </div>
          <button
            onClick={refreshAssessments}
            disabled={refreshing}
            style={{
              fontSize: 13,
              padding: "6px 14px",
              background: refreshing ? "#334155" : "#1e293b",
              border: "1px solid #334155",
              borderRadius: 6,
              cursor: "pointer",
              color: "#e2e8f0",
            }}
          >
            {refreshing ? "Refreshing..." : "\u21BB Refresh"}
          </button>
        </div>

        {/* Content area */}
        <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
          {view === "setup" && <UploadScreen onDone={loadSites} />}
          {view === "dashboard" && (
            <FleetDashboard
              sites={sites}
              assessments={assessments}
              onSelectSite={selectSite}
            />
          )}
          {view === "map" && (
            <FleetMap sites={sites} assessments={assessments} />
          )}
          {view === "site" && (
            <SiteDetail
              siteId={selectedSite}
              onBack={() => setView("dashboard")}
            />
          )}
          {view === "route" && <RoutePlanner />}
          {view === "heatpl" && <HeatPLScreen />}
          {view === "reports" && <ReportsScreen sites={sites} />}
          {view === "kelvin" && <KelvinPanel />}
          {view === "settings" && (
            <SettingsScreen
              policy={policy}
              onSave={async (p) => {
                await updatePolicy(p);
                setPolicy(p);
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "10px 24px",
            borderTop: "1px solid #1e293b",
            background: "#111827",
            fontSize: 12,
            color: "#475569",
          }}
        >
          <span>
            Powered by FortyGuard {"\u00b7"} 20m resolution {"\u00b7"} Live
            as of {refreshTime || "\u2014"}
          </span>
          <span>
            20m FortyGuard grid vs. ~11km typical weather-station grid
          </span>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          display: "none",
          background: "#111827",
          borderTop: "1px solid #1e293b",
          justifyContent: "space-around",
          padding: "6px 0",
          zIndex: 999,
        }}
        className="mobile-nav"
      >
        {(["dashboard", "map", "route", "heatpl", "kelvin"] as View[]).map(
          (v) => {
            const item = NAV_ITEMS.find((n) => n[0] === v)!;
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  background: "none",
                  border: "none",
                  color: view === v ? "#06b6d4" : "#64748b",
                  fontSize: 10,
                  cursor: "pointer",
                  padding: "4px 8px",
                }}
              >
                <span style={{ fontSize: 18 }}>{item[1]}</span>
                {item[2]}
              </button>
            );
          }
        )}
      </nav>

      {/* Responsive CSS */}
      <style>{`
        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .mobile-nav { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
