// Runs once when the Next.js server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  process.on("unhandledRejection", (reason) => {
    console.error("[process] unhandledRejection:", reason);
  });

  // State after an uncaught exception is undefined: log it and exit so
  // Docker's `restart: always` brings up a clean process.
  process.on("uncaughtException", (err) => {
    console.error("[process] uncaughtException:", err);
    process.exit(1);
  });
}
