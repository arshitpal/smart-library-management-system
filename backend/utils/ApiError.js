// An expected failure with an HTTP status; the error handler sends it to the client.
class ApiError extends Error {
  constructor(status, message, details = []) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

module.exports = ApiError;
