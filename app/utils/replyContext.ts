/**
 * Parsing for the markdown-encoded reply header that
 * `buildReplyMessage` (in useDashboardData) embeds at the top of a
 * reply message:
 *
 *     > Replying to @<username>
 *     > <one-line excerpt of the parent>
 *     > <continuation of the excerpt if it wrapped>
 *
 *     <the actual reply body>
 *
 * The wire format is just markdown — there's no `reply_to_message_id`
 * column on the server side — so the only way to render a richer
 * "reply card" UI in the message list (avatar, click-to-jump) is to
 * detect this pattern at render time and pull out:
 *
 *   - author:  the `@<username>` that follows "Replying to"
 *   - excerpt: the joined `>` lines that came after the header
 *   - body:    everything else, with the reply header stripped so
 *              the regular renderer doesn't paint a duplicate
 *              blockquote underneath the card
 *
 * The parse is intentionally conservative: any deviation from the
 * exact "> Replying to @X" prefix on the very first line causes us
 * to fall back to `null` and let the message render as plain
 * markdown. That keeps user-written blockquotes (e.g. someone
 * pasting "> Replying to @foo" as a literal quote) from being
 * mistaken for our marker — the marker is only valid as the very
 * first line.
 */
export interface ParsedReplyContext {
  /** Username extracted from "Replying to @<username>". */
  author: string;
  /** Concatenated excerpt of the parent message (one line). */
  excerpt: string;
  /** Reply body with the marker block stripped. */
  body: string;
}

const HEADER_PATTERN = /^>\s*Replying to @(\S+)\s*$/;

export function parseReplyContext(content: string): ParsedReplyContext | null {
  if (!content) return null;

  const lines = content.split("\n");
  if (lines.length === 0) return null;

  const headerMatch = lines[0].match(HEADER_PATTERN);
  if (!headerMatch) return null;

  const author = headerMatch[1];

  // Gather the contiguous `>` lines that follow the header as the
  // excerpt. They all share the `> ` prefix that `buildReplyMessage`
  // adds; strip it before joining so the excerpt is plain text.
  const excerptParts: string[] = [];
  let i = 1;
  while (i < lines.length && lines[i].startsWith(">")) {
    const stripped = lines[i].replace(/^>\s?/, "");
    if (stripped.length > 0) {
      excerptParts.push(stripped);
    }
    i += 1;
  }

  // Skip any blank separator lines between the excerpt block and the
  // reply body. `buildReplyMessage` inserts exactly one, but we
  // tolerate more so a manual edit isn't punished.
  while (i < lines.length && lines[i].trim() === "") {
    i += 1;
  }

  const body = lines.slice(i).join("\n");
  const excerpt = excerptParts.join(" ").replace(/\s+/g, " ").trim();

  return {
    author,
    excerpt,
    body,
  };
}

/**
 * Find the parent message in a (typically channel-scoped) list of
 * messages, given the author/excerpt extracted from the reply
 * header. The header doesn't include the parent's UUID — we ship
 * markdown over the wire, not a typed reply edge — so this is a
 * heuristic match.
 *
 * Matching strategy, in order:
 *   1. Newest message whose author matches AND whose normalized
 *      message body starts with the excerpt (the excerpt is a
 *      prefix-truncated version of the parent's body in
 *      `buildReplyMessage`).
 *   2. Newest message whose author matches AND whose body contains
 *      the excerpt anywhere (loosens for edited-after-reply cases).
 *   3. null — caller renders the reply card as non-interactive so
 *      the user still sees who was replied to, just without the
 *      jump-to affordance.
 *
 * "Newest" is right because if the same user has said the same
 * thing twice, the reply is almost always to the more recent one.
 */
export function findReplyParent<
  M extends {
    message_id: string;
    message: string;
    username?: string;
    sender_user_id?: string;
  }
>(
  messages: M[],
  author: string,
  excerpt: string,
  usernameOf: (senderUserId: string) => string | undefined,
): M | null {
  if (!author || messages.length === 0) return null;
  const normalizedExcerpt = excerpt.replace(/\s+/g, " ").trim();
  const authorLower = author.toLowerCase();

  // Walk newest-first to get the "most recent matching message"
  // for free, since the messages array is chronological and we
  // pick the first hit.
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const candidate = messages[i];
    const candidateAuthor =
      candidate.username ||
      (candidate.sender_user_id ? usernameOf(candidate.sender_user_id) : undefined);
    if (!candidateAuthor) continue;
    if (candidateAuthor.toLowerCase() !== authorLower) continue;

    if (!normalizedExcerpt) {
      // Excerpt was empty (attachment-only message); first author
      // match is the best we can do.
      return candidate;
    }
    const normalizedBody = (candidate.message || "").replace(/\s+/g, " ").trim();
    if (normalizedBody.startsWith(normalizedExcerpt)) {
      return candidate;
    }
  }

  // Pass 2: loosen to "contains" if the strict prefix didn't match.
  // Covers the case where the parent was edited after the reply was
  // posted, so its current body no longer starts with the excerpt.
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const candidate = messages[i];
    const candidateAuthor =
      candidate.username ||
      (candidate.sender_user_id ? usernameOf(candidate.sender_user_id) : undefined);
    if (!candidateAuthor) continue;
    if (candidateAuthor.toLowerCase() !== authorLower) continue;

    const normalizedBody = (candidate.message || "").replace(/\s+/g, " ").trim();
    if (normalizedBody.includes(normalizedExcerpt)) {
      return candidate;
    }
  }

  return null;
}
