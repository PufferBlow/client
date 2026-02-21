import type { Route } from "./+types/settings";
import SettingsPage from "../components/pages/SettingsPage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Settings - Pufferblow" },
    { name: "description", content: "Manage your account and app settings" },
  ];
}

export default function SettingsRoute() {
  return <SettingsPage />;
}