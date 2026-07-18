import {
  ChartColumn,
  FileText,
  History,
  Info,
  Plane,
  Search,
  Star,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { NavItem, ThemeToggle } from "../components";
import type { SearchResult } from "./useSearchResult";
import { AboutView } from "./views/AboutView";
import { AircraftView } from "./views/AircraftView";
import { FlightPlanView } from "./views/FlightPlanView";
import { ResultsView } from "./views/ResultsView";
import { RunDetailView } from "./views/RunDetailView";
import { RunsView } from "./views/RunsView";
import { SavedRoutesView } from "./views/SavedRoutesView";
import { SearchView } from "./views/SearchView";

export type View =
  "search" | "results" | "ofp" | "saved" | "aircraft" | "runs" | "about";

const THEME_STORAGE_KEY = "ar-theme";

type Theme = "light" | "dark";

function initialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "dark" ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function AppShell({
  initialView,
  searchResult,
}: {
  initialView: View;
  searchResult: SearchResult;
}) {
  const navigate = useNavigate();
  const params = useParams<{ flightPlanId?: string; runId?: string }>();
  const [view, setView] = useState<View>(initialView);
  const [theme, setThemeState] = useState<Theme>(() => {
    const initial = initialTheme();
    applyTheme(initial);
    return initial;
  });
  const flightPlanId = params.flightPlanId ?? searchResult.flightPlanId;
  const runId = params.runId ?? null;

  function setTheme(next: Theme) {
    applyTheme(next);
    setThemeState(next);
  }

  function goTo(next: View, path: string) {
    setView(next);
    navigate(path);
  }

  function openFlightPlan(id: string) {
    navigate(`/flight-plans/${id}`);
  }

  const navItems = [
    {
      id: "search" as const,
      label: "Nueva búsqueda",
      icon: Search,
      onClick: () => goTo("search", "/"),
    },
    {
      id: "results" as const,
      label: "Resultados",
      icon: ChartColumn,
      onClick: () => goTo("results", "/"),
    },
    {
      id: "ofp" as const,
      label: "Plan de vuelo",
      icon: FileText,
      onClick: () => (flightPlanId ? openFlightPlan(flightPlanId) : null),
    },
    {
      id: "saved" as const,
      label: "Rutas guardadas",
      icon: Star,
      onClick: () => goTo("saved", "/flight-plans"),
    },
    {
      id: "aircraft" as const,
      label: "Aeronaves",
      icon: Plane,
      onClick: () => goTo("aircraft", "/"),
    },
  ];

  return (
    <div className="ar-shell" data-theme={theme}>
      <aside className="ar-sidebar">
        <a
          aria-label="Ir a nueva búsqueda"
          className="ar-sidebar__logo"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            goTo("search", "/");
          }}
        >
          <span className="ar-brand__mark" style={{ width: 34, height: 34 }}>
            <Plane aria-hidden="true" size={16} strokeWidth={1.8} />
          </span>
          <span>
            <div style={{ fontWeight: 800, fontSize: 16 }}>AeroRoute</div>
            <div
              style={{
                color: "var(--ar-accent)",
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              MLX
            </div>
          </span>
        </a>

        <nav className="ar-nav" aria-label="Navegación principal">
          {navItems.map((item) => (
            <NavItem
              active={view === item.id}
              disabled={item.id === "ofp" && !flightPlanId}
              icon={item.icon}
              key={item.id}
              label={item.label}
              onClick={item.onClick}
            />
          ))}
          <div className="ar-nav-separator" aria-hidden="true" />
          <NavItem
            active={view === "runs"}
            icon={History}
            label="Historial"
            onClick={() => goTo("runs", "/runs")}
          />
          <NavItem
            active={view === "about"}
            icon={Info}
            label="Acerca de"
            onClick={() => goTo("about", "/about")}
          />
        </nav>

        <ThemeToggle
          onToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
          theme={theme}
        />

        <div className="ar-sim-notice">
          <div className="ar-sim-notice__label">Modo simulador</div>
          <div className="ar-sim-notice__body">
            Simulación educativa. No apta para despacho operacional.
          </div>
        </div>
      </aside>

      <main className="ar-main">
        {view === "search" ? (
          <SearchView
            searchResult={searchResult}
            onSubmitted={() => goTo("results", "/")}
          />
        ) : null}
        {view === "results" ? (
          <ResultsView
            searchResult={searchResult}
            onOpenFlightPlan={() => {
              if (flightPlanId) openFlightPlan(flightPlanId);
            }}
          />
        ) : null}
        {view === "ofp" ? <FlightPlanView flightPlanId={flightPlanId} /> : null}
        {view === "saved" ? (
          <SavedRoutesView onSelect={(id) => openFlightPlan(id)} />
        ) : null}
        {view === "aircraft" ? <AircraftView /> : null}
        {view === "runs" ? (
          runId ? (
            <RunDetailView runId={runId} />
          ) : (
            <RunsView onSelect={(id) => navigate(`/runs/${id}`)} />
          )
        ) : null}
        {view === "about" ? <AboutView /> : null}
      </main>
    </div>
  );
}
