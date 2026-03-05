import jwt from 'jsonwebtoken';
import {Account} from '../models/Account.js'; // Your Account.js path

const authenticate = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const account = await Account.findById(decoded.id).select('role');

      if (!account) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Role check
      if (allowedRoles.length && !allowedRoles.includes(account.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      req.user = account;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Token expired or invalid' });
    }
  };
};

export default authenticate;
