const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

const { loadEnv } = require("../src/config/env");

let env;
try {
  env = loadEnv(process.env);
} catch (err) {
  // Load failed (missing vars) — fall back to safe defaults for local dev
  console.warn("env validation failed, falling back to defaults:", err.message);
  env = {
    BASE_URL: process.env.BASE_URL || "http://localhost:3000",
    NODE_ENV: process.env.NODE_ENV || "development",
  };
}

const app = express();

app.use(helmet());

if (env.NODE_ENV === "production") {
  app.use(cors({ origin: env.BASE_URL }));
} else {
  app.use(cors());
}

app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));

app.get("/", (req, res) => res.json({ status: "ok" }));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API listening on ${port} (env=${env.NODE_ENV})`);
});
