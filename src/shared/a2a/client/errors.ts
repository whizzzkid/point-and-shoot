/** Typed failure returned by the portable A2A client boundary. */
export class A2AClientError extends Error {
  /**
   * Creates a portable client error.
   *
   * @param message - Safe diagnostic text that excludes remote response bodies and credentials.
   */
  constructor(message: string) {
    super(message);
    this.name = "A2AClientError";
  }
}
