import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttachmentBubble } from "./AttachmentBubble";
import { downloadFileViaBlob } from "../utils/downloadFile";

vi.mock("../utils/downloadFile", () => ({
  downloadFileViaBlob: vi.fn(),
}));

vi.mock("./VideoPlayer", () => ({
  VideoPlayer: () => <div data-testid="video-player">video</div>,
}));

describe("AttachmentBubble download actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps image download control isolated from main click handler", async () => {
    vi.mocked(downloadFileViaBlob).mockResolvedValueOnce({ success: true });
    const onClick = vi.fn();

    render(
      <AttachmentBubble
        url="http://localhost:7575/storage/image.png"
        filename="image.png"
        type="image/png"
        size={2048}
        onClick={onClick}
      />,
    );

    const downloadButton = screen.getByRole("button", { name: "Download image.png" });
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(downloadFileViaBlob).toHaveBeenCalledTimes(1);
    });
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders a hover/focus download button for videos", () => {
    render(
      <AttachmentBubble
        url="http://localhost:7575/storage/video.mp4"
        filename="video.mp4"
        type="video/mp4"
        size={4096}
      />,
    );

    const downloadButton = screen.getByRole("button", { name: "Download video.mp4" });
    expect(downloadButton.className).toContain("group-hover:opacity-100");
    expect(downloadButton.className).toContain("group-focus-within:opacity-100");
  });

  it("does not render visible media filename overlays for images or videos", () => {
    const { rerender } = render(
      <AttachmentBubble
        url="http://localhost:7575/storage/image.png"
        filename="image.png"
        type="image/png"
        size={2048}
      />,
    );

    expect(screen.queryByText("image.png")).not.toBeInTheDocument();

    rerender(
      <AttachmentBubble
        url="http://localhost:7575/storage/video.mp4"
        filename="video.mp4"
        type="video/mp4"
        size={4096}
      />,
    );

    expect(screen.queryByText("video.mp4")).not.toBeInTheDocument();
  });

  it("uses blob helper for audio and generic file downloads", async () => {
    vi.mocked(downloadFileViaBlob).mockResolvedValue({ success: true });

    const { rerender } = render(
      <AttachmentBubble
        url="http://localhost:7575/storage/voice.mp3"
        filename="voice.mp3"
        type="audio/mpeg"
        size={1024}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    await waitFor(() => {
      expect(downloadFileViaBlob).toHaveBeenCalledTimes(1);
    });

    rerender(
      <AttachmentBubble
        url="http://localhost:7575/storage/readme.pdf"
        filename="readme.pdf"
        type="application/pdf"
        size={1024}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    await waitFor(() => {
      expect(downloadFileViaBlob).toHaveBeenCalledTimes(2);
    });
  });
});
