const jwt = require("jsonwebtoken");
const jwt_secret = process.env.JWT_TOKEN;

function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "No Token Provided" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No Token Provided" });

  jwt.verify(token, jwt_secret, (err, decodedId) => {
    if (err) return res.status(403).json({ error: "Invalid/Expired token" });
    req.decodedId = decodedId;
    next();
  });
}

module.exports = authMiddleware;
