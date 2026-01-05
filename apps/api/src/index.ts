import server from "#/server.js";
import env from "#/configs/env.js";

const port = env.PORT;

void (async () => {
  try {
    /** Listening express/socket.io server */
    server.listen(port, () => {
      /** Server running information log. */
      console.log(`Server running on port: ${port}\n`);
    });
  } catch (error: any) {
    console.error(`Error: ${error.message}\n`);
    process.exit(1);
  }
})();
