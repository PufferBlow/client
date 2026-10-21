import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { spaceIconStyle, spaceInitials } from "../../lib/spaceIcon";
import { SpaceIcon } from "./SpaceIcon";

describe("space icons", () => {
  it("takes two letters from a name", () => {
    expect(spaceInitials("Deadlock Community")).toBe("DC");
    expect(spaceInitials("kiln.social")).toBe("KS");
    expect(spaceInitials("switchyard")).toBe("SW");
    expect(spaceInitials("")).toBe("?");
  });

  it("gives an id the same style every time, spread over all four", () => {
    expect(spaceIconStyle("lanes.gg")).toBe(spaceIconStyle("LANES.gg "));
    const seen = new Set(Array.from({ length: 60 }, (_, i) => spaceIconStyle(`host-${i}.example`)));
    expect(seen).toEqual(new Set(["initials", "crop", "bubble", "school"]));
  });

  it("draws a picture instead when there is one, and a coloured rounded square when there is not", () => {
    const withPicture = render(<SpaceIcon id="a" name="A B" src="https://x/y.png" size={48} />);
    expect(withPicture.container.querySelector("img")).toHaveAttribute("src", "https://x/y.png");
    withPicture.unmount();

    const plain = render(<SpaceIcon id="lanes.gg" name="lanes.gg" size={48} />);
    const box = plain.container.firstElementChild as HTMLElement;
    expect(box.style.borderRadius).toBe("30%");
    expect(box.style.width).toBe("48px");
    expect(box.style.background).not.toBe("");
  });
});
