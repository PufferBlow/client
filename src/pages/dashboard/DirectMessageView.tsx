import { useEffect } from "react";
import { Navigate, useParams, useSearchParams } from "react-router";
import { DirectMessagePanel } from "../../components/dashboard/DirectMessagePanel";
import { HomeSidebar } from "../../components/dashboard/HomeSidebar";
import { useConversations } from "../../features/dms/hooks";
import { useMarkDmRead } from "../../features/dms/unread";

/** `/dashboard/dms/:conversationId?peer=<handle>`: the home sidebar and one DM conversation. */
export function DirectMessageView() {
  const { conversationId = "" } = useParams();
  const [params] = useSearchParams();
  const { data: conversations } = useConversations();
  const conversation = conversations?.find((c) => c.id === conversationId);
  const peer = params.get("peer") ?? conversation?.peerUsername ?? "";
  useMarkDmRead(conversationId);

  useEffect(() => {
    localStorage.setItem("pb_last_route", "/dashboard");
  }, []);

  // Without a peer there is nothing to load the conversation by.
  if (!peer && conversations !== undefined) return <Navigate to="/dashboard/friends" replace />;

  return (
    <>
      <HomeSidebar activeConversationId={conversationId} />
      {peer && <DirectMessagePanel key={conversationId} conversationId={conversationId} peer={peer} conversation={conversation} />}
    </>
  );
}
