import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./Layout.tsx";
import { AuditPage } from "./pages/AuditPage.tsx";
import { ComparePage } from "./pages/ComparePage.tsx";
import { RiderPhonePage } from "./pages/RiderPhonePage.tsx";
import { SimulatorPage } from "./pages/SimulatorPage.tsx";

export const ROUTES = [
  { path: "/simulator", label: "Simulator", element: <SimulatorPage /> },
  { path: "/compare", label: "Compare", element: <ComparePage /> },
  { path: "/audit", label: "Audit", element: <AuditPage /> },
  { path: "/rider", label: "Rider phone", element: <RiderPhonePage /> },
] as const;

export function App() {
  return (
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
  );
}
