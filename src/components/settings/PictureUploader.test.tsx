import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { checkPicture, mayAnimate } from "../../features/pictures/upload";
import { PictureUploader } from "./PictureUploader";

const picture = (name: string, type: string, bytes = 1024) => new File([new Uint8Array(bytes)], name, { type });

describe("checkPicture", () => {
  it("accepts the picture formats, animated ones included", () => {
    for (const [name, type] of [["a.png", "image/png"], ["a.jpg", "image/jpeg"], ["a.webp", "image/webp"], ["a.gif", "image/gif"], ["a.avif", "image/avif"]]) {
      expect(checkPicture({ name: name!, type: type!, size: 10 })).toBeNull();
    }
  });

  it("refuses what is not a picture, is empty, or is over the limit", () => {
    expect(checkPicture({ name: "notes.pdf", type: "application/pdf", size: 10 })).toMatch(/not a picture/);
    expect(checkPicture({ name: "a.png", type: "image/png", size: 0 })).toMatch(/empty/);
    expect(checkPicture({ name: "a.png", type: "image/png", size: 3 * 1024 * 1024 }, 2)).toMatch(/2 MB/);
    expect(checkPicture({ name: "a.png", type: "image/png", size: 1024 }, 2)).toBeNull();
  });

  it("knows which formats can move", () => {
    expect(mayAnimate({ name: "a.gif", type: "image/gif" })).toBe(true);
    expect(mayAnimate({ name: "a.webp", type: "" })).toBe(true);
    expect(mayAnimate({ name: "a.png", type: "image/png" })).toBe(false);
  });
});

describe("PictureUploader", () => {
  const base = { label: "Avatar", kind: "avatar" as const, custom: false };

  it("shows the default art until there is a picture, then the picture", () => {
    const { rerender } = render(<PictureUploader {...base} upload={vi.fn()} />);
    expect(screen.getByText("Default")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload picture" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use the default" })).not.toBeInTheDocument();

    rerender(<PictureUploader {...base} custom current="https://x.test/a.gif" upload={vi.fn()} revert={vi.fn()} />);
    expect(screen.getByRole("img", { name: "Your avatar" })).toHaveAttribute("src", "https://x.test/a.gif");
    expect(screen.getByRole("button", { name: "Replace picture" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use the default" })).toBeInTheDocument();
  });

  it("uploads the chosen file and says so, noting that an animated one will move", async () => {
    const user = userEvent.setup();
    const upload = vi.fn(async (_file: File, onProgress: (loaded: number, total: number) => void) => onProgress(512, 1024));
    render(<PictureUploader {...base} upload={upload} />);

    await user.upload(screen.getByLabelText("Avatar file"), picture("party.gif", "image/gif"));
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    expect(upload.mock.calls[0]![0].name).toBe("party.gif");
    expect(await screen.findByText(/Avatar saved\. If it is animated, it will move\./)).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows progress while the file goes up", async () => {
    const user = userEvent.setup();
    let finish: () => void = () => undefined;
    const upload = vi.fn(
      (_file: File, onProgress: (loaded: number, total: number) => void) =>
        new Promise<void>((resolve) => {
          onProgress(256, 1024);
          finish = resolve;
        }),
    );
    render(<PictureUploader {...base} upload={upload} />);
    await user.upload(screen.getByLabelText("Avatar file"), picture("a.png", "image/png"));

    const bar = await screen.findByRole("progressbar", { name: "Uploading the avatar" });
    expect(bar).toHaveAttribute("aria-valuenow", "25");
    expect(screen.getByRole("button", { name: "Upload picture" })).toBeDisabled();
    finish();
    await screen.findByText("Avatar saved.");
  });

  it("refuses a file that is not a picture without sending it", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const upload = vi.fn();
    render(<PictureUploader {...base} upload={upload} />);
    await user.upload(screen.getByLabelText("Avatar file"), picture("notes.pdf", "application/pdf"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/not a picture/);
    expect(upload).not.toHaveBeenCalled();
  });

  it("says why an upload failed, and goes back to the default", async () => {
    const user = userEvent.setup();
    const upload = vi.fn().mockRejectedValue(new Error("nope"));
    const revert = vi.fn().mockResolvedValue(undefined);
    render(<PictureUploader {...base} custom current="https://x.test/a.png" upload={upload} revert={revert} />);

    await user.upload(screen.getByLabelText("Avatar file"), picture("a.png", "image/png"));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Use the default" }));
    expect(revert).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Back to the default.")).toBeInTheDocument();
  });
});
