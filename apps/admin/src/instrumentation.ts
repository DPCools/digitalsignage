// Prevents a single bad external connection (e.g. an SMTP TLS handshake
// failure like ssl3_get_record:wrong version number) from crashing the whole
// admin server process. Node's default behavior for an unhandled 'error'
// event on an EventEmitter — which some libraries emit on the underlying
// socket independently of the promise chain a caller awaits — is to crash
// the process even if the corresponding promise was already caught.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    process.on('uncaughtException', (err) => {
      console.error('[uncaughtException]', err);
    });
    process.on('unhandledRejection', (reason) => {
      console.error('[unhandledRejection]', reason);
    });
  }
}
