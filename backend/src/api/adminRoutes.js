const { createQueueBoard } = require("../services/bullBoard");

function sendLoginPage(res, error = false) {
  return res.type("html").send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Admin login</title></head>
<body><main><h1>Admin login</h1>${error ? '<p role="alert">Incorrect password.</p>' : ""}
<form method="post" action="/admin/login">
<label>Password <input type="password" name="password" autocomplete="current-password" required autofocus></label>
<button type="submit">Sign in</button>
</form></main></body></html>`);
}

function registerAdminRoutes(
  app,
  { adminAuth, adminPassword, clickQueue, clickDlq, rateLimit, rateLimits },
) {
  app.use("/admin", rateLimit("admin", rateLimits.admin));

  app.get("/admin/login", (req, res) => {
    if (adminAuth.isAuthenticated(req)) {
      return res.redirect(303, "/admin/queues");
    }

    return sendLoginPage(res);
  });

  app.post(
    "/admin/login",
    rateLimit("admin-login", rateLimits.adminLogin),
    (req, res) => {
      if (!adminAuth.safeEqual(req.body.password || "", adminPassword)) {
        return sendLoginPage(res.status(401), true);
      }

      adminAuth.setSession(res);
      return res.redirect(303, "/admin/queues");
    },
  );

  app.post("/admin/logout", (req, res) => {
    adminAuth.clearSession(res);
    res.redirect(303, "/admin/login");
  });

  app.use(
    "/admin/queues",
    adminAuth.requireAuth,
    createQueueBoard({ clickQueue, clickDlq }),
  );
}

module.exports = {
  registerAdminRoutes,
};
