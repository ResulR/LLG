import "dotenv/config";

import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import { pool } from "./db/pool.js";

import { authRouter } from "./routes/auth.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { doctorsRouter } from "./routes/doctors.js";
import { worksRouter } from "./routes/works.js";
import { paymentsRouter } from "./routes/payments.js";
import { materialsRouter } from "./routes/materials.js";
import { colorsRouter } from "./routes/colors.js";

import { requireAuth } from "./middleware/auth.js";


const app = express();

const port =
  Number(process.env.PORT || 4400);


app.disable("x-powered-by");

app.set(
  "trust proxy",
  1,
);


app.use(
  helmet(),
);

app.use(
  express.json({
    limit:"100kb",
    strict:true,
  }),
);

app.use(
  cookieParser(),
);


app.use(
  "/api/auth",
  authRouter,
);

app.use(
  "/api/dashboard",
  dashboardRouter,
);

app.use(
  "/api/doctors",
  doctorsRouter,
);

app.use(
  "/api/works",
  worksRouter,
);

app.use(
  "/api/payments",
  paymentsRouter,
);

app.use(
  "/api/materials",
  materialsRouter,
);

app.use(
  "/api/colors",
  colorsRouter,
);


app.get(
  "/api/health",
  (_req, res) => {

    return res.json({
      status:"ok",
      service:"dentaltrack-api",
    });

  },
);


app.get(
  "/api/health/db",
  requireAuth,
  async (_req, res) => {

    try {

      await pool.query(
        "SELECT 1;",
      );


      return res.json({
        status:"ok",
        database:"reachable",
      });


    } catch(error) {

      console.error(
        "Database health check failed",
        error,
      );


      return res.status(503).json({
        status:"error",
        database:"unavailable",
      });

    }

  },
);


app.use(
  (
    error:any,
    _req:express.Request,
    res:express.Response,
    next:express.NextFunction,
  ) => {

    if(
      error instanceof SyntaxError &&
      "body" in error
    ) {

      return res.status(400).json({
        error:"invalid_json",
      });

    }


    return next(error);

  },
);


app.use(
  (
    error:any,
    _req:express.Request,
    res:express.Response,
    _next:express.NextFunction,
  ) => {

    console.error(
      "Unhandled API error",
      error,
    );


    return res.status(500).json({
      error:"internal_server_error",
    });

  },
);


app.listen(
  port,
  "127.0.0.1",
  () => {

    console.log(
      `DentalTrack API running on port ${port}`,
    );

  },
);
