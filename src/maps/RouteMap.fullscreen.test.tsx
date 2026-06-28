// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { RouteMap } from "./RouteMap";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

describe("RouteMap fullscreen mode", () => {
  it("opens and closes from the map control", async () => {
    const user = userEvent.setup();
    render(<RouteMap candidate={null} />);

    await user.click(
      screen.getByRole("button", { name: "Open fullscreen map" })
    );

    expect(
      screen.getByRole("figure", { name: "Fullscreen interactive route map" })
    ).toHaveClass("route-map--fullscreen");
    expect(document.body).toHaveStyle({ overflow: "hidden" });

    await user.click(
      screen.getByRole("button", { name: "Exit fullscreen map" })
    );

    expect(screen.queryByRole("figure")).not.toHaveClass(
      "route-map--fullscreen"
    );
    expect(document.body.style.overflow).toBe("");
  });

  it("exits fullscreen when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(<RouteMap candidate={null} />);
    await user.click(
      screen.getByRole("button", { name: "Open fullscreen map" })
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(
      screen.getByRole("button", { name: "Open fullscreen map" })
    ).toBeVisible();
    expect(document.body.style.overflow).toBe("");
  });
});
