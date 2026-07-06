import { Route, Routes } from "react-router-dom";
import { Header } from "./components/Header";
import { Home } from "./pages/Home";
import { Activity } from "./pages/Activity";
import { Admin } from "./pages/Admin";
import { AdminActivity } from "./pages/AdminActivity";
import { AdminDevice } from "./pages/AdminDevice";

export default function App() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/a/:id" element={<Activity />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/a/:id" element={<AdminActivity />} />
          <Route path="/admin/d/:id" element={<AdminDevice />} />
        </Routes>
      </main>
    </div>
  );
}
