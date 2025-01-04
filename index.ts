import { execute } from "./dist/bundler";

const entryFile = "./example/entry.js";

(async () => {
  const bundle = await execute(entryFile);

  console.log(bundle);
})();
