import { describe, expect, it } from "vitest";

import { isAuthorizedBearer } from "../src/auth.js";

function makeReq(authorization?: string) {
  return {
    headers: {
      authorization
    }
  } as any;
}

describe("isAuthorizedBearer", () => {
  it("returns true for valid bearer token", () => {
    expect(isAuthorizedBearer(makeReq("Bearer secret-1"), "secret-1")).toBe(true);
  });

  it("returns false for missing or invalid token", () => {
    expect(isAuthorizedBearer(makeReq(undefined), "secret-1")).toBe(false);
    expect(isAuthorizedBearer(makeReq("Bearer wrong"), "secret-1")).toBe(false);
    expect(isAuthorizedBearer(makeReq("Basic abc"), "secret-1")).toBe(false);
  });
});
