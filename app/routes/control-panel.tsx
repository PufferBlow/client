import ControlPanelPage from "../components/pages/ControlPanelPage";

export function meta() {
  return [
    { title: "Server Control Panel - Pufferblow" },
    { name: "description", content: "Manage and configure your server settings" },
  ];
}

export default function ControlPanelRoute() {
  return <ControlPanelPage />;
}