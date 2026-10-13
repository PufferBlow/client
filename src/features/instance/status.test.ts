import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../../services/api";
import { renewSession } from "../../services/auth";
import { getInstanceStatus, reportRequestError, reportRequestSuccess, resetInstanceStatus, setInstanceStatus } from "./status";

vi.mock("../../services/auth", () => ({ renewSession: vi.fn() }));
const renew = vi.mocked(renewSession);

const network = () => new ApiError(0, "network", "Failed to fetch");
const invalidToken = () => new ApiError(401, "auth.invalid_token", "Your session has expired. Sign in again.");

let client: QueryClient;
beforeEach(() => {
  resetInstanceStatus();
  client = new QueryClient();
  vi.spyOn(client, "invalidateQueries").mockResolvedValue();
});
afterEach(() => resetInstanceStatus());

describe("instance status", () => {
  it("is unreachable after a request gets no answer, and ok after the next one does", () => {
    reportRequestError(network(), client);
    expect(getInstanceStatus()).toBe("unreachable");
    reportRequestSuccess();
    expect(getInstanceStatus()).toBe("ok");
  });

  it("treats a timeout like no answer", () => {
    reportRequestError(new ApiError(0, "timeout", "Request timed out"), client);
    expect(getInstanceStatus()).toBe("unreachable");
  });

  it("leaves ordinary errors to the view that made the request", () => {
    reportRequestError(new ApiError(500, "unknown", "boom"), client);
    reportRequestError(new ApiError(403, "auth.privilege_denied", "no"), client);
    reportRequestError(new Error("not an api error"), client);
    expect(getInstanceStatus()).toBe("ok");
  });

  it("renews a refused session silently and refetches everything", async () => {
    renew.mockResolvedValue("renewed");
    reportRequestError(invalidToken(), client);
    await waitFor(() => expect(client.invalidateQueries).toHaveBeenCalled());
    expect(getInstanceStatus()).toBe("ok");
  });

  it("renews once for a burst of refused requests", async () => {
    renew.mockResolvedValue("renewed");
    reportRequestError(invalidToken(), client);
    reportRequestError(invalidToken(), client);
    reportRequestError(invalidToken(), client);
    await waitFor(() => expect(client.invalidateQueries).toHaveBeenCalledTimes(1));
    expect(renew).toHaveBeenCalledTimes(1);
  });

  it("signs out when the session can't be renewed", async () => {
    renew.mockResolvedValue("rejected");
    reportRequestError(invalidToken(), client);
    await waitFor(() => expect(getInstanceStatus()).toBe("signed_out"));
  });

  it("does not sign out when renewing failed only because the instance is down", async () => {
    renew.mockResolvedValue("unreachable");
    reportRequestError(invalidToken(), client);
    await waitFor(() => expect(getInstanceStatus()).toBe("unreachable"));
  });

  it("signs out instead of looping when a just-renewed token is refused again", async () => {
    renew.mockResolvedValue("renewed");
    reportRequestError(invalidToken(), client);
    await waitFor(() => expect(client.invalidateQueries).toHaveBeenCalled());

    reportRequestError(invalidToken(), client);
    expect(getInstanceStatus()).toBe("signed_out");
    expect(renew).toHaveBeenCalledTimes(1);
  });

  it("stays signed out until something resets it", () => {
    setInstanceStatus("signed_out");
    reportRequestError(network(), client);
    reportRequestSuccess();
    expect(getInstanceStatus()).toBe("signed_out");
  });
});
