// npm start -w api: the HeatGate API on port 3001 (or $PORT), with the in-memory store.
import { createApp } from "./app.ts";
import { MemoryStore } from "../store/memory.ts";

const port = Number(process.env.PORT ?? 3001);
createApp({ store: new MemoryStore() }).listen(port, () => {
  console.log(`HeatGate API listening on http://localhost:${port}`);
});
