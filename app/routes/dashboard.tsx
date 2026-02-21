import type { Route } from "./+types/dashboard";
import DashboardPage from "../components/pages/DashboardPage";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Pufferblow - Decentralized Messaging" },
    { name: "description", content: "Discord-like messaging with decentralized servers" },
  ];
}

export default function DashboardRoute() {
  return <DashboardPage />;
}