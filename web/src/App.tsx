import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./Layout.tsx";
import { AuditPage } from "./pages/AuditPage.tsx";
import { ComparePage } from "./pages/ComparePage.tsx";
import { RiderPhonePage } from "./pages/RiderPhonePage.tsx";
import { SimulatorPage } from "./pages/SimulatorPage.tsx";

export const ROUTES = [
  { path: "/simulator", label: "Policy Sandbox", element: <SimulatorPage /> },
  { path: "/rider", label: "Rider View", element: <RiderPhonePage /> },
  { path: "/audit", label: "Audit Log", element: <AuditPage /> },
  { path: "/compare", label: "Platform View", element: <ComparePage /> },
] as const;

import { SimulationProvider } from "./context/SimulationContext.tsx";

export function App() {
  return (
    <SimulationProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout routes={ROUTES} />}>
            <Route index element={<Navigate to="/simulator" replace />} />
            {ROUTES.map((r) => (
              <Route key={r.path} path={r.path} element={r.element} />
            ))}
            <Route path="*" element={<Navigate to="/simulator" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SimulationProvider>
  );
}
