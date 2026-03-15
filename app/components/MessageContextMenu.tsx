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

function icon(path: string | string[]) {
  const paths = Array.isArray(path) ? path : [path];
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {paths.map((d, i) => (
        <path key={i} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
      ))}
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
      icon: icon("M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"),
      onSelect: onEdit,
    });
  }

  if (canDelete && onDelete) {
    items.push({
      id: "delete",
      label: "Delete",
      tone: "danger",
      icon: icon("M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"),
      onSelect: onDelete,
    });
  }

  if (canPin && onPin) {
    items.push({
      id: "pin",
      label: "Pin Message",
      icon: icon(["M12 2L5 9v1h14V9zM12 10v10", "M9 20h6"]),
      onSelect: onPin,
    });
  }

  if (onReact) {
    items.push({
      id: "react",
      label: "Add Reaction",
      icon: icon("M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"),
      onSelect: onReact,
    });
  }

  if (onCopyLink) {
    items.push({
      id: "copy-link",
      label: customCopyLinkLabel || "Copy Message Link",
      icon: icon("M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.768-1.767m0-5.657l1.767-1.768a4 4 0 115.657 5.657l-4 4a4 4 0 01-5.657 0"),
      onSelect: onCopyLink,
    });
  }

  if (canReport && onReport) {
    items.push({
      id: "report",
      label: customReportLabel || "Report",
      tone: "warning",
      icon: icon("M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"),
      onSelect: onReport,
    });
  }

  return (
    <ContextMenu isOpen={isOpen} position={position} onClose={onClose} items={items} minWidth={220} />
  );
}

