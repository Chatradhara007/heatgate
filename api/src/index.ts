// npm start -w api: the HeatGate API on port 3001 (or $PORT). In-memory store unless STORE=dynamo.
import { createApp } from "./app.ts";
import { createStore } from "../store/index.ts";

const port = Number(process.env.PORT ?? 3001);
createApp({ store: createStore() }).listen(port, () => {
  console.log(`HeatGate API listening on http://localhost:${port}`);
});
