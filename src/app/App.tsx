import { Route, Routes } from "react-router-dom";

import { AppShell } from "./AppShell";
import { useSearchResult } from "./useSearchResult";

export function App() {
  // Lifted above <Routes> so search/results state survives navigation to
  // routes that mount a fresh AppShell instance (OFP, saved routes, etc.).
  const searchResult = useSearchResult();

  // React Router reconciles <AppShell> as the same component instance across
  // these <Route> entries (it's the same component type at the same tree
  // position), so it does NOT remount on its own when navigating between
  // them - a `key` per route "family" forces the intentional remount each
  // needs to pick up its own `initialView`/params. Do not remove this: without
  // it, navigating e.g. Results -> OFP updates the URL but leaves the old
  // view rendered.
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AppShell
            key="search"
            initialView="search"
            searchResult={searchResult}
          />
        }
      />
      <Route
        path="/flight-plans"
        element={
          <AppShell
            key="saved"
            initialView="saved"
            searchResult={searchResult}
          />
        }
      />
      <Route
        path="/flight-plans/:flightPlanId"
        element={
          <AppShell key="ofp" initialView="ofp" searchResult={searchResult} />
        }
      />
      <Route
        path="/runs"
        element={
          <AppShell
            key="runs-list"
            initialView="runs"
            searchResult={searchResult}
          />
        }
      />
      <Route
        path="/runs/:runId"
        element={
          <AppShell
            key="runs-detail"
            initialView="runs"
            searchResult={searchResult}
          />
        }
      />
      <Route
        path="/about"
        element={
          <AppShell
            key="about"
            initialView="about"
            searchResult={searchResult}
          />
        }
      />
    </Routes>
  );
}
