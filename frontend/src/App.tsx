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
import AlertBanner from "./components/AlertBanner";
import { useTheme } from "./lib/theme";

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [routeNav, setRouteNav] = useState<{ originId: string; destId: string } | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<number>(() => {
    return parseInt(localStorage.getItem("shade_auto_refresh") || "0", 10);
  });

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

  // Auto-refresh interval
  useEffect(() => {
    if (autoRefresh <= 0) return;
    const timer = setInterval(() => {
      refreshAssessments();
    }, autoRefresh);
    return () => clearInterval(timer);
  }, [autoRefresh, refreshAssessments]);

  const handleAutoRefreshChange = (ms: number) => {
    setAutoRefresh(ms);
    localStorage.setItem("shade_auto_refresh", String(ms));
  };

  const selectSite = (id: string) => {
    setSelectedSite(id);
    setView("site");
  };

  const navigateToRoute = (originId: string, destId: string) => {
    setRouteNav({ originId, destId });
    setView("route");
  };

  const handleDashboardNavigate = (target: string, options?: any) => {
    setView(target as View);
  };

  // Get highest risk across all assessments for Kelvin avatar
  const highestRisk = assessments.length
    ? [...assessments].sort((a, b) => {
        const order: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return (order[b.risk_bucket] || 0) - (order[a.risk_bucket] || 0);
      })[0].risk_bucket
    : "LOW";

  const { theme, toggleTheme, colors } = useTheme();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: colors.bg, transition: "background 0.3s" }}>
      {/* Sidebar */}
      <nav
        style={{
          width: sidebarCollapsed ? 64 : 220,
          background: colors.surface,
          borderRight: `1px solid ${colors.border}`,
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          transition: "width 0.2s ease",
        }}
        className="sidebar-desktop"
      >
        {/* Logo area */}
        <div
          style={{
            padding: sidebarCollapsed ? "16px 8px" : "20px 16px",
            borderBottom: `1px solid ${colors.border}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <img
            src="/shade-logo.jpeg"
            alt="Shade logo"
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              objectFit: "contain",
              flexShrink: 0,
            }}
          />
          {!sidebarCollapsed && (
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5, color: colors.text, margin: 0 }}>
                Shade
              </h1>
              <p style={{ fontSize: 11, color: colors.textMuted, marginTop: 0 }}>
                FortyGuard-powered safety
              </p>
            </div>
          )}
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, padding: "8px 6px" }}>
          {NAV_ITEMS.map(([v, icon, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              title={sidebarCollapsed ? label : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: sidebarCollapsed ? "10px 8px" : "10px 12px",
                marginBottom: 2,
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: view === v ? 600 : 400,
                background: view === v ? colors.surfaceHover : "transparent",
                color: view === v ? colors.accent : colors.textSecondary,
                textAlign: sidebarCollapsed ? "center" : "left",
                justifyContent: sidebarCollapsed ? "center" : "flex-start",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
              {!sidebarCollapsed && <span>{label}</span>}
            </button>
          ))}
        </div>

        {/* Bottom section */}
        <div style={{ padding: "8px 6px", borderTop: "1px solid #1e293b" }}>
          <button
            onClick={() => setView("setup")}              style={{
                width: "100%",
                padding: sidebarCollapsed ? "8px" : "8px 12px",
                background: colors.surfaceHover,
                border: `1px solid ${colors.borderLight}`,
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
              color: colors.textSecondary,
              display: "flex",
              alignItems: "center",
              gap: 8,
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
            }}
          >
            {!sidebarCollapsed ? "\u2699 Site Setup" : "\u2699"}
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
            padding: "10px 16px",
            borderBottom: `1px solid ${colors.border}`,
            background: colors.surface,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/shade-logo.jpeg" alt="Shade" style={{ width: 24, height: 24, borderRadius: 4 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: colors.text }}>Shade</span>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="sidebar-desktop"
              style={{
                fontSize: 16,
                background: "none",
                border: "none",
                color: colors.textMuted,
                cursor: "pointer",
                padding: "4px 8px",
              }}
              title="Toggle sidebar"
            >
              {"\u2630"}
            </button>
            <button
              onClick={toggleTheme}
              style={{
                fontSize: 16,
                background: "none",
                border: "none",
                color: colors.textMuted,
                cursor: "pointer",
                padding: "4px 8px",
              }}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? "\u2600" : "\u263E"}
            </button>
            {refreshTime && (
              <span
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                  background: colors.surfaceHover,
                  padding: "4px 10px",
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#22c55e",
                    flexShrink: 0,
                  }}
                />
                Refreshed {refreshTime} ({refreshMs}ms)
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {assessments.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginRight: 8 }}>
                {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((bucket) => {
                  const count = assessments.filter((a) => a.risk_bucket === bucket).length;
                  if (!count) return null;
                  const riskColors: Record<string, string> = { CRITICAL: "#dc2626", HIGH: "#ea580c", MEDIUM: "#d97706", LOW: "#16a34a" };
                  return (
                    <span
                      key={bucket}
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: `${riskColors[bucket]}20`,
                        color: riskColors[bucket],
                        fontWeight: 600,
                      }}
                    >
                      {count} {bucket}
                    </span>
                  );
                })}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Auto-refresh selector */}
              <select
                value={autoRefresh}
                onChange={(e) => handleAutoRefreshChange(Number(e.target.value))}
                style={{
                  fontSize: 12,
                  padding: "5px 8px",
                  background: autoRefresh > 0 ? "#064e3b" : colors.surfaceHover,
                  border: `1px solid ${autoRefresh > 0 ? "#059669" : colors.borderLight}`,
                  borderRadius: 6,
                  color: autoRefresh > 0 ? "#6ee7b7" : colors.textSecondary,
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <option value={0}>Auto: Off</option>
                <option value={30000}>Auto: 30s</option>
                <option value={60000}>Auto: 1m</option>
                <option value={300000}>Auto: 5m</option>
              </select>
              <button
                onClick={refreshAssessments}
                disabled={refreshing}
                style={{
                  fontSize: 13,
                  padding: "6px 14px",
                  background: refreshing ? colors.borderLight : colors.surfaceHover,
                  border: `1px solid ${colors.borderLight}`,
                  borderRadius: 8,
                  cursor: "pointer",
                  color: colors.text,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s",
                }}
              >
                <span style={{ animation: refreshing ? "spin 1s linear infinite" : "none", display: "inline-block" }}>
                  {"\u21BB"}
                </span>
                {refreshing ? "Assessing..." : "Refresh"}
              </button>
            </div>
          </div>
        </div>

        {/* Live Alert Banner */}
        <AlertBanner assessments={assessments} onSelectSite={selectSite} />

        {/* Content area */}
        <div className="main-content" style={{ flex: 1, padding: 24, overflowY: "auto" }}>
          {view === "setup" && <UploadScreen onDone={loadSites} />}
          {view === "dashboard" && (
            <FleetDashboard
              sites={sites}
              assessments={assessments}
              onSelectSite={selectSite}
              onNavigate={handleDashboardNavigate}
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
          {view === "route" && (
            <RoutePlanner
              initialOriginId={routeNav?.originId}
              initialDestId={routeNav?.destId}
              onRoutePlanned={() => setRouteNav(null)}
            />
          )}
          {view === "heatpl" && <HeatPLScreen />}
          {view === "reports" && <ReportsScreen sites={sites} />}
          {view === "kelvin" && <KelvinPanel onNavigateRoute={navigateToRoute} />}
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
            padding: "8px 24px",
            borderTop: `1px solid ${colors.border}`,
            background: colors.surface,
            fontSize: 11,
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
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
        /* Table row hover — works in both dark and light mode */
        .site-table tbody tr {
          transition: background 0.1s;
        }
        .site-table tbody tr:hover {
          background: ${colors.surfaceHover} !important;
        }
        .site-table tbody tr.selected-row {
          background: ${colors.accent}12 !important;
        }
        .site-table tbody tr.selected-row:hover {
          background: ${colors.accent}20 !important;
        }
        .comparison-table tbody tr.comp-row {
          transition: background 0.1s;
        }
        .comparison-table tbody tr.comp-row:hover {
          background: ${colors.surfaceHover} !important;
        }
        /* Comparison hint */
        .compare-hint {
          font-size: 11px;
          color: ${colors.textMuted};
          margin-top: 4px;
        }
        /* Mobile responsive */
        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .mobile-nav { display: flex !important; }
          .main-content { padding: 16px !important; }
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 480px) {
          .stats-grid { gridTemplateColumns: "1fr" !important; }
        }
      `}</style>
    </div>
  );
}
