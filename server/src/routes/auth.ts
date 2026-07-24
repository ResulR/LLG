import { Router } from "express";
import cookieParser from "cookie-parser";
import { createToken, verifyUser, verifyToken } from "../services/auth.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: "missing_credentials",
    });
  }

  const user = await verifyUser(username, password);

  if (!user) {
    return res.status(401).json({
      error: "invalid_credentials",
    });
  }

  const token = createToken(user.id);

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "strict",
    maxAge: 8 * 60 * 60 * 1000,
  });

  res.json({
    id: user.id,
    username: user.username,
  });
});

router.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({
    status: "ok",
  });
});

router.get("/me", requireAuth, (req, res) => {
  const user = req.user;

  res.json({
    authenticated: true,
    user,
  });
});

export { router as authRouter };
