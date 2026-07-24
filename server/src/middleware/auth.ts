import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/auth.js";

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({
      error: "unauthorized",
    });
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({
      error: "invalid_token",
    });
  }
}
