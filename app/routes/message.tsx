import type { Route } from "./+types/message";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Pufferblow - Message Sharing Disabled" },
    { name: "description", content: "Message sharing feature is currently disabled" },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  // This functionality is disabled since required API endpoints are not available
  // in the provided API reference
  throw new Response("Message sharing feature is temporarily disabled - API endpoints not available", { status: 501 });
}

export default function MessagePage() {
  // This component will never render due to the loader throwing
  return null;
}
