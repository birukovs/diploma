export const protectRoute = (req, res, next) => {
    if (!req.auth().userId){
        return res.status(401).json({ message: "Неавторизованный доступ" });
    }

    next();
}