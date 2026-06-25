/** Error carrying an HTTP status, thrown by data-layer functions. */
export class AppError extends Error {
  status;
  constructor(message, status = 400) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}
