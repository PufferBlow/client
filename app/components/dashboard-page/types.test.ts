import { describe, expect, it } from "vitest";
import type { Message } from "../../models";
import { getAttachmentCategory, groupMessagesByAuthor, normalizeExtensions } from "./types";

function createMessage(overrides: Partial<Message>): Message {
  return {
    message_id: overrides.message_id ?? "message-1",
    message: overrides.message ?? "hello",
    hashed_message: overrides.hashed_message ?? "hash",
    sender_user_id: overrides.sender_user_id ?? "user-1",
    sent_at: overrides.sent_at ?? "2026-03-15T10:00:00.000Z",
    ...overrides,
  };
}

describe("dashboard-page helpers", () => {
  it("normalizes extension lists", () => {
    expect(normalizeExtensions([".PNG", " jpg ", "", ".Md"])).toEqual(["png", "jpg", "md"]);
    expect(normalizeExtensions(null)).toEqual([]);
  });

  it("categorizes attachments from extensions and mime types", () => {
    const imageFile = new File(["image"], "banner.PNG", { type: "application/octet-stream" });
    const videoFile = new File(["video"], "clip.bin", { type: "video/mp4" });
    const audioFile = new File(["audio"], "track.mp3", { type: "audio/mpeg" });
    const otherFile = new File(["text"], "notes.txt", { type: "text/plain" });

    const policy = {
      imageExtensions: ["png", "jpg"],
      videoExtensions: ["mp4", "mov"],
      audioExtensions: ["mp3", "wav"],
    };

    expect(getAttachmentCategory(imageFile, policy)).toBe("image");
    expect(getAttachmentCategory(videoFile, policy)).toBe("video");
    expect(getAttachmentCategory(audioFile, policy)).toBe("audio");
    expect(getAttachmentCategory(otherFile, policy)).toBe("file");
  });

  it("groups consecutive messages by author within thirty seconds", () => {
    const groups = groupMessagesByAuthor([
      createMessage({
        message_id: "m1",
        sender_user_id: "user-1",
        sent_at: "2026-03-15T10:00:00.000Z",
      }),
      createMessage({
        message_id: "m2",
        sender_user_id: "user-1",
        sent_at: "2026-03-15T10:00:20.000Z",
      }),
      createMessage({
        message_id: "m3",
        sender_user_id: "user-2",
        sent_at: "2026-03-15T10:00:25.000Z",
      }),
      createMessage({
        message_id: "m4",
        sender_user_id: "user-1",
        sent_at: "2026-03-15T10:01:00.000Z",
      }),
    ]);

    expect(groups).toHaveLength(3);
    expect(groups[0].map((message) => message.message_id)).toEqual(["m1", "m2"]);
    expect(groups[1].map((message) => message.message_id)).toEqual(["m3"]);
    expect(groups[2].map((message) => message.message_id)).toEqual(["m4"]);
  });

  it("starts a new group when the same author exceeds the grouping window", () => {
    const groups = groupMessagesByAuthor([
      createMessage({
        message_id: "m1",
        sender_user_id: "user-1",
        sent_at: "2026-03-15T10:00:00.000Z",
      }),
      createMessage({
        message_id: "m2",
        sender_user_id: "user-1",
        sent_at: "2026-03-15T10:00:31.000Z",
      }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0][0].message_id).toBe("m1");
    expect(groups[1][0].message_id).toBe("m2");
  });
});
