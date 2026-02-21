import { ContextMenu, type ContextMenuItem } from "./ui/ContextMenu";

interface MessageContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPin?: () => void;
  onReact?: () => void;
  onCopyLink?: () => void;
  onReport?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canPin?: boolean;
  canReport?: boolean;
  customCopyLinkLabel?: string;
  customReportLabel?: string;
}

function icon(path: string) {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    </svg>
  );
}

export function MessageContextMenu({
  isOpen,
  position,
  onClose,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onReact,
  onCopyLink,
  onReport,
  canEdit = false,
  canDelete = false,
  canPin = false,
  canReport = true,
  customCopyLinkLabel,
  customReportLabel,
}: MessageContextMenuProps) {
  const items: ContextMenuItem[] = [];

  if (onReply) {
    items.push({
      id: "reply",
      label: "Reply",
      icon: icon("M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"),
      onSelect: onReply,
    });
  }

  if (canEdit && onEdit) {
    items.push({
      id: "edit",
      label: "Edit",
      icon: icon("M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5"),
      onSelect: onEdit,
    });
  }

  if (canDelete && onDelete) {
    items.push({
      id: "delete",
      label: "Delete",
      tone: "danger",
      icon: icon("M19 7l-.867 12.142A2 2 0 0116.138 21H7.862A2 2 0 015.867 19.142L5 7"),
      onSelect: onDelete,
    });
  }

  if (canPin && onPin) {
    items.push({
      id: "pin",
      label: "Pin Message",
      icon: icon("M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"),
      onSelect: onPin,
    });
  }

  if (onReact) {
    items.push({
      id: "react",
      label: "Add Reaction",
      icon: icon("M14.828 14.828a4 4 0 01-5.656 0M9 10h6"),
      onSelect: onReact,
    });
  }

  if (onCopyLink) {
    items.push({
      id: "copy-link",
      label: customCopyLinkLabel || "Copy Message Link",
      icon: icon("M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656"),
      onSelect: onCopyLink,
    });
  }

  if (canReport && onReport) {
    items.push({
      id: "report",
      label: customReportLabel || "Report",
      tone: "warning",
      icon: icon("M12 9v2m0 4h.01m-6.938 4h13.856"),
      onSelect: onReport,
    });
  }

  return (
    <ContextMenu isOpen={isOpen} position={position} onClose={onClose} items={items} minWidth={220} />
  );
}

