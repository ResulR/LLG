import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import {
  createToken,
  verifyUser,
} from "../services/auth.js";

import { requireAuth } from "../middleware/auth.js";


const router = Router();


const cookieSecure =
  process.env.COOKIE_SECURE === "true";


const cookieOptions = {
  httpOnly:true,
  secure:cookieSecure,
  sameSite:"strict" as const,
  maxAge:8 * 60 * 60 * 1000,
  path:"/",
};


const loginLimiter = rateLimit({
  windowMs:15 * 60 * 1000,
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
  async (req, res) => {

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


      const token =
        createToken(user.id);


      res.cookie(
        "token",
        token,
        cookieOptions,
      );


      return res.json({
        id:user.id,
        username:user.username,
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


router.post("/logout", (_req, res) => {

  res.clearCookie(
    "token",
    {
      httpOnly:true,
      secure:cookieSecure,
      sameSite:"strict",
      path:"/",
    },
  );


  return res.json({
    status:"ok",
  });

});


router.get(
  "/me",
  requireAuth,
  (req, res) => {

    return res.json({
      authenticated:true,
      user:req.user,
    });

  },
);


export { router as authRouter };
