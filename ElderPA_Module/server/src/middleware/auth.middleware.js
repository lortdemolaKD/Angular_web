import jwt from "jsonwebtoken";

export function attachUser(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) return next();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: payload.sub,
      role: payload.role,
      companyId: payload.companyId ?? null,
      locationId: payload.locationId ?? null, // add this if you add it to signToken()
    };

    return next();
  } catch {
    return next();
  }
}
