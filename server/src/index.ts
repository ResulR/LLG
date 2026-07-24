import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth.js";
import helmet from "helmet";
import { pool } from "./db/pool.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { doctorsRouter } from "./routes/doctors.js";
import { worksRouter } from "./routes/works.js";
import { paymentsRouter } from "./routes/payments.js";

const app = express();
const port = 4400;

app.use(helmet());
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/doctors", doctorsRouter);
app.use("/api/works", worksRouter);
app.use("/api/payments", paymentsRouter);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "dentaltrack-api",
  });
});

app.get("/api/health/db", async (_req, res) => {
  const result = await pool.query(
    "SELECT current_database(), current_user;"
  );

  res.json({
    status: "ok",
    database: result.rows[0].current_database,
    user: result.rows[0].current_user,
  });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`DentalTrack API running on port ${port}`);
});
