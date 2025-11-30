const errorHandler = (err, req, res, next) => {
  console.error("ERROR:", err);
  const statusCode = res.statusCode ? res.statusCode : 500;
  res.status(statusCode).json({
    message: "Please check your network connectivity OR refresh the page.",
    stack: process.env.NODE_ENV === "development" ? err.stack : null,
  });
};

module.exports = errorHandler;
