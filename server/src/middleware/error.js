export const notFound = (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: `API route not found: ${req.originalUrl}` });
  }
  next();
};

export const errorHandler = (err, req, res, _next) => {
  console.error('[API ERROR]', err.message);
  const status = err.status || (res.statusCode >= 400 ? res.statusCode : 500);
  res.status(status).json({ success: false, message: err.message || 'Internal server error' });
};
