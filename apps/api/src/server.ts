import { createServer } from "node:http";

import app from "#/app.js";

const server = createServer(app);

export default server;
