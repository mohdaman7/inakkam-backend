const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Mongoose duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern || {})[0];
        message = `${field ? field.charAt(0).toUpperCase() + field.slice(1) : 'Field'} already exists`;
        statusCode = 409;
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        message = Object.values(err.errors).map((e) => e.message).join(', ');
        statusCode = 400;
    }

    // Mongoose cast error (bad ObjectId)
    if (err.name === 'CastError') {
        message = 'Resource not found';
        statusCode = 404;
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        message = 'Invalid token';
        statusCode = 401;
    }
    if (err.name === 'TokenExpiredError') {
        message = 'Token expired';
        statusCode = 401;
    }

    if (process.env.NODE_ENV === 'development') {
        console.error(`[ERROR] ${err.stack}`);
    }

    res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

module.exports = errorHandler;
