import { describe, expect, it } from "vitest";

import { findReplyParent, parseReplyContext } from "./replyContext";

describe("parseReplyContext", () => {
  it("returns null for non-reply content", () => {
    expect(parseReplyContext("hello world")).toBeNull();
    expect(parseReplyContext("")).toBeNull();
    expect(parseReplyContext("> just a regular blockquote")).toBeNull();
  });

  it("extracts author + excerpt + body from a standard reply", () => {
    const content = [
      "> Replying to @alice",
      "> hey what's up",
      "",
      "lol nice",
    ].join("\n");
    expect(parseReplyContext(content)).toEqual({
      author: "alice",
      excerpt: "hey what's up",
      body: "lol nice",
    });
  });

  it("joins multi-line excerpts onto a single line", () => {
    const content = [
      "> Replying to @bob",
      "> line one",
      "> line two",
      "",
      "the reply",
    ].join("\n");
    const parsed = parseReplyContext(content);
    expect(parsed?.excerpt).toBe("line one line two");
    expect(parsed?.body).toBe("the reply");
  });

  it("handles an empty excerpt (attachment-only parent)", () => {
    const content = ["> Replying to @charlie", "the reply"].join("\n");
    const parsed = parseReplyContext(content);
    expect(parsed?.author).toBe("charlie");
    expect(parsed?.excerpt).toBe("");
    expect(parsed?.body).toBe("the reply");
  });

  it("preserves blank lines inside the reply body", () => {
    const content = [
      "> Replying to @dave",
      "> something",
      "",
      "first paragraph",
      "",
      "second paragraph",
    ].join("\n");
    expect(parseReplyContext(content)?.body).toBe(
      "first paragraph\n\nsecond paragraph",
    );
  });

  it("extracts the visible body even when the target itself was a reply (no nested history)", () => {
    // This is the input shape we feed back into the excerpt
    // builder when replying to a reply — the parse should return
    // the inner reply's own body so the next-generation reply
    // quotes what was actually said, not the chain.
    const content = [
      "> Replying to @alice",
      "> hey what's up",
      "",
      "lol nice",
    ].join("\n");
    expect(parseReplyContext(content)?.body).toBe("lol nice");
  });
});

describe("findReplyParent", () => {
  const usernameOf = (id: string) => ({ u1: "alice", u2: "bob" }[id]);

  it("matches by author + excerpt prefix, preferring newest", () => {
    const messages = [
      { message_id: "m1", message: "hey what's up old", username: "alice", sender_user_id: "u1" },
      { message_id: "m2", message: "hey what's up new", username: "alice", sender_user_id: "u1" },
      { message_id: "m3", message: "unrelated", username: "alice", sender_user_id: "u1" },
    ];
    expect(
      findReplyParent(messages, "alice", "hey what's up", usernameOf)?.message_id,
    ).toBe("m2");
  });

  it("falls back to a contains match when no prefix matches", () => {
    const messages = [
      { message_id: "m1", message: "edited: hey what's up", username: "alice", sender_user_id: "u1" },
    ];
    expect(
      findReplyParent(messages, "alice", "hey what's up", usernameOf)?.message_id,
    ).toBe("m1");
  });

  it("returns null when nothing matches", () => {
    const messages = [
      { message_id: "m1", message: "wrong author", username: "bob", sender_user_id: "u2" },
    ];
    expect(findReplyParent(messages, "alice", "anything", usernameOf)).toBeNull();
  });

  it("treats an empty excerpt as 'first author match wins'", () => {
    const messages = [
      { message_id: "m1", message: "old", username: "alice", sender_user_id: "u1" },
      { message_id: "m2", message: "new", username: "alice", sender_user_id: "u1" },
    ];
    expect(findReplyParent(messages, "alice", "", usernameOf)?.message_id).toBe(
      "m2",
    );
  });
});
