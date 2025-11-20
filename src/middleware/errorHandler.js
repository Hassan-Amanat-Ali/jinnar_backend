export const errorHandler = (err, req, res, next) => {
  try {
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';

    // Log full error server-side for debugging
    console.error('💥 Error:', {
      message: err.message,
      stack: err.stack,
      status,
      path: req.originalUrl,
      method: req.method,
    });

    // In production hide stack traces
    const response = { error: message };
    if (process.env.NODE_ENV !== 'production') {
      response.stack = err.stack;
    }

    res.status(status).json(response);
  } catch (handlerErr) {
    // If error handler throws, at least log and send minimal response
    console.error('ErrorHandler failed:', handlerErr);
    res.status(500).json({ error: 'Fatal error' });
  }
};