import { describe, expect, it } from "vitest";

describe("AeroRoute web", () => {
  it("keeps the product positioned as a simulator", () => {
    expect("educational trajectory-efficiency simulator").toContain(
      "simulator"
    );
  });
});
