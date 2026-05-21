export const protectRoute = (req, res, next) => {
  const userId = req.auth?.().userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  return next();
};
