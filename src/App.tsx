import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { PinGate } from "@/components/PinGate";
import { Dashboard } from "@/pages/Dashboard";
import { Generate } from "@/pages/Generate";
import { Review } from "@/pages/Review";
import { Wrap } from "@/pages/Wrap";
import { Settings } from "@/pages/Settings";
import { getToken } from "@/lib/auth";

export default function App() {
  const [authed, setAuthed] = useState(() => !!getToken());

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    function onAuthRequired() {
      setAuthed(false);
    }
    window.addEventListener("dopamine:auth-required", onAuthRequired);
    return () =>
      window.removeEventListener("dopamine:auth-required", onAuthRequired);
  }, []);

  if (!authed) {
    return <PinGate onSuccess={() => setAuthed(true)} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="generate" element={<Generate />} />
          <Route path="review" element={<Review />} />
          <Route path="wrap" element={<Wrap />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
