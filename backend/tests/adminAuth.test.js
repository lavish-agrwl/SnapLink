const { createAdminAuth } = require("../src/services/adminAuth");

function createResponse() {
  return {
    clearCookie: jest.fn(),
    cookie: jest.fn(),
    redirect: jest.fn(),
  };
}

describe("admin authentication", () => {
  test("redirects unauthenticated requests to the login page", async () => {
    const auth = createAdminAuth({ password: "test-password" });
    const response = createResponse();
    const next = jest.fn();

    auth.requireAuth({ headers: {}, originalUrl: "/admin/queues" }, response, next);

    expect(response.redirect).toHaveBeenCalledWith(
      303,
      "/admin/login?returnTo=%2Fadmin%2Fqueues",
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("accepts the signed session cookie it creates", () => {
    const auth = createAdminAuth({ password: "test-password" });
    const response = createResponse();
    const next = jest.fn();

    auth.setSession(response);
    const [, token] = response.cookie.mock.calls[0];
    auth.requireAuth(
      { headers: { cookie: `snaplink_admin=${token}` }, originalUrl: "/admin/queues" },
      createResponse(),
      next,
    );

    expect(next).toHaveBeenCalled();
  });

  test("rejects a forged session cookie", async () => {
    const auth = createAdminAuth({ password: "test-password" });
    const response = createResponse();
    const next = jest.fn();
    auth.requireAuth(
      {
        headers: { cookie: "snaplink_admin=authenticated.forged" },
        originalUrl: "/admin/queues",
      },
      response,
      next,
    );

    expect(response.redirect).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
