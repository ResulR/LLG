import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import {
  createToken,
  verifyToken,
  verifyUser,
} from "../services/auth.js";

import {
  createSession,
  revokeSession,
} from "../services/session.js";

import {
  requireAuth,
  requireAuthWithoutActivity,
} from "../middleware/auth.js";


const router =
  Router();


const cookieSecure =
  process.env.COOKIE_SECURE === "true";


const sessionCookieOptions = {
  httpOnly:true,
  secure:cookieSecure,
  sameSite:"strict" as const,
  path:"/",
};


const loginLimiter =
  rateLimit({

    windowMs:
      15 * 60 * 1000,

    limit:10,

    standardHeaders:"draft-8",

    legacyHeaders:false,

    skipSuccessfulRequests:true,

    message:{
      error:"too_many_login_attempts",
    },

  });


router.post(
  "/login",
  loginLimiter,
  async (req,res) => {

    const username =
      typeof req.body?.username === "string"
        ? req.body.username.trim()
        : "";

    const password =
      typeof req.body?.password === "string"
        ? req.body.password
        : "";


    if(
      !username ||
      !password
    ) {

      return res.status(400).json({
        error:"missing_credentials",
      });

    }


    if(
      username.length > 100 ||
      password.length > 200
    ) {

      return res.status(400).json({
        error:"invalid_credentials_format",
      });

    }


    try {

      const user =
        await verifyUser(
          username,
          password,
        );


      if(!user) {

        return res.status(401).json({
          error:"invalid_credentials",
        });

      }


      const session =
        await createSession(
          user.id,
        );


      const token =
        createToken(
          user.id,
          session.id,
        );


      res.cookie(
        "token",
        token,
        sessionCookieOptions,
      );


      return res.json({
        id:user.id,
        username:user.username,
        session,
      });


    } catch(error) {

      console.error(
        "Authentication failure",
        error,
      );


      return res.status(500).json({
        error:"authentication_failed",
      });

    }

  },
);


router.post(
  "/logout",
  async (req,res) => {

    const token =
      req.cookies?.token;


    if(token) {

      try {

        const payload =
          verifyToken(token);


        await revokeSession(
          payload.sessionId,
          payload.userId,
        );


      } catch(error) {

        console.warn(
          "Logout session revocation skipped",
          error instanceof Error
            ? error.message
            : "unknown_error",
        );

      }

    }


    res.clearCookie(
      "token",
      sessionCookieOptions,
    );


    return res.json({
      status:"ok",
    });

  },
);


router.post(
  "/activity",
  requireAuth,
  (req,res) => {

    return res.json({
      status:"ok",
      session:req.sessionInfo,
    });

  },
);


router.get(
  "/me",
  requireAuthWithoutActivity,
  (req,res) => {

    return res.json({
      authenticated:true,
      user:req.user,
      session:req.sessionInfo,
    });

  },
);


export {
  router as authRouter,
};
