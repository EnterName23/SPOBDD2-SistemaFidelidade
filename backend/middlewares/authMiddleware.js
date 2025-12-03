const jwt = require("jsonwebtoken");
const JWT_SECRET = "segredo_super_forte";

function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({ erro: "Token ausente" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        return res.status(401).json({ erro: "Token inválido" });
    }
}

module.exports = authMiddleware;
