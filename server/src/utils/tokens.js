import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const signToken = (user) =>
  jwt.sign(
    { id: String(user._id), role: user.role, email: user.email, flatId: user.flatId || null },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );

export const verifyToken = (token) => jwt.verify(token, env.JWT_SECRET);
