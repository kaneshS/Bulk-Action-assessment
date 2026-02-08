import { createApp } from "./app.js";
import { config } from "./config/index.js";

const app = createApp();

app.listen(config.port, () => {
  console.log(`Bulk Action Platform API running on port ${config.port}`);
});
