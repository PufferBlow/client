import { ContextMenu, type ContextMenuItem } from "./ui/ContextMenu";

interface UserContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onViewProfile?: () => void;
  onSendMessage?: () => void;
  onAddFriend?: () => void;
  onMention?: () => void;
  onBlock?: () => void;
  onReport?: () => void;
  canBlock?: boolean;
  canReport?: boolean;
  isFriend?: boolean;
  isBlocked?: boolean;
}

function icon(path: string) {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    </svg>
  );
}

export function UserContextMenu({
  isOpen,
  position,
  onClose,
  onViewProfile,
  onSendMessage,
  onAddFriend,
  onMention,
  onBlock,
  onReport,
  canBlock = true,
  canReport = true,
  isFriend = false,
  isBlocked = false,
}: UserContextMenuProps) {
  const items: ContextMenuItem[] = [];

  if (onViewProfile) {
    items.push({
      id: "view-profile",
      label: "View Profile",
      icon: icon("M5.121 17.804A9 9 0 1118.88 6.197M15 11a3 3 0 11-6 0"),
      onSelect: onViewProfile,
    });
  }

  if (onSendMessage) {
    items.push({
      id: "send-message",
      label: "Send Message",
      icon: icon("M8 10h8m-8 4h4m8 5l-3-3H5a2 2 0 01-2-2V6a2 2 0 012-2h14"),
      onSelect: onSendMessage,
    });
  }

  if (onAddFriend) {
    items.push({
      id: "friend",
      label: isFriend ? "Remove Friend" : "Add Friend",
      icon: icon("M18 9a3 3 0 11-6 0 3 3 0 016 0M6 20v-1a4 4 0 014-4h4"),
      onSelect: onAddFriend,
    });
  }

  if (onMention) {
    items.push({
      id: "mention",
      label: "Mention",
      icon: icon("M16 8a6 6 0 11-4.472 10M12 12a2 2 0 10-2-2"),
      onSelect: onMention,
    });
  }

  if (canBlock && onBlock) {
    items.push({
      id: "block",
      label: isBlocked ? "Unblock" : "Block",
      tone: isBlocked ? "success" : "danger",
      icon: icon("M18.364 5.636l-12.728 12.728M5.636 5.636l12.728 12.728"),
      onSelect: onBlock,
    });
  }

  if (canReport && onReport) {
    items.push({
      id: "report",
      label: "Report",
      tone: "warning",
      icon: icon("M12 9v2m0 4h.01M5.07 19h13.86L12 5z"),
      onSelect: onReport,
    });
  }

  return <ContextMenu isOpen={isOpen} position={position} onClose={onClose} items={items} minWidth={220} />;
}

