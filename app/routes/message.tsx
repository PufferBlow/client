import type { Route } from "./+types/message";
import { useEffect } from "react";
import { Navigate } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Pufferblow - Message Sharing Disabled" },
    { name: "description", content: "Message sharing feature is currently disabled" },
  ];
}

export default function MessagePage() {
  // This functionality is disabled since required API endpoints are not available
  // in the provided API reference

  useEffect(() => {
    alert("Message sharing feature is temporarily disabled - API endpoints not available");
  }, []);

  // Redirect to dashboard
  return <Navigate to="/dashboard" replace />;
}
