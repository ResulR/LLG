import type {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  verifyToken,
} from "../services/auth.js";

import {
  validateSession,
} from "../services/session.js";


const cookieSecure =
  process.env.COOKIE_SECURE === "true";


function clearAuthCookie(
  res:Response,
) {

  res.clearCookie(
    "token",
    {
      httpOnly:true,
      secure:cookieSecure,
      sameSite:"strict",
      path:"/",
    },
  );

}


function createAuthMiddleware(
  touchActivity:boolean,
) {

  return async function authenticate(
    req:Request,
    res:Response,
    next:NextFunction,
  ) {

    const token =
      req.cookies?.token;


    if(!token) {

      return res.status(401).json({
        error:"unauthorized",
      });

    }


    try {

      const payload =
        verifyToken(token);


      const session =
        await validateSession(
          payload.sessionId,
          payload.userId,
          touchActivity,
        );


      if(!session) {

        clearAuthCookie(res);

        return res.status(401).json({
          error:"session_expired",
        });

      }


      req.user =
        payload;

      req.sessionInfo =
        session;


      return next();


    } catch {

      clearAuthCookie(res);

      return res.status(401).json({
        error:"invalid_token",
      });

    }

  };

}


export const requireAuth =
  createAuthMiddleware(true);


export const requireAuthWithoutActivity =
  createAuthMiddleware(false);
