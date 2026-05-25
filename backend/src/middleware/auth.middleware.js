import { getAuth } from "@clerk/express";

export const protectRoute = (req, res, next) => {
  try {
    const auth = getAuth(req);
    const { userId } = auth;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.userId = userId;
    req.authData = auth;
    return next();
  } catch (error) {
    console.error("Clerk auth error:", error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};
