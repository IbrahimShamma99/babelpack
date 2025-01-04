import fs from "fs";
import path from "path";
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import { transformFromAstAsync } from "@babel/core";
import { ImportDeclaration } from "@babel/types";

let COUNT = 0;

type Asset = {
  id: number;
  filename: string;
  code: string | undefined;
  imports: string[];
  mapping: Record<string, number>;
};

async function createBundleAsset(filename: string): Promise<Asset> {
  const content = fs.readFileSync(filename, "utf-8");

  const ast = parse(content, {
    sourceType: "module",
  });

  const imports: string[] = [];

  traverse(ast, {
    ImportDeclaration: ({ node }: { node: ImportDeclaration }) => {
      imports.push(node.source.value);
    },
  });

  const id = COUNT++;

  const babelResult = await transformFromAstAsync(ast, undefined, {
    presets: ["env"],
  });

  if (!babelResult?.code) {
    throw new Error("Unable to parse/extract code");
  }

  const { code } = babelResult;

  return {
    id,
    filename,
    code,
    imports,
    mapping: {},
  };
}

async function createBundleGraph(entry: string) {
  const mainAsset = await createBundleAsset(entry);

  const queue = [mainAsset];

  for (const asset of queue) {
    const dirname = path.dirname(asset.filename);

    asset.imports.forEach(async (relativePath) => {
      const absolutePath = path.join(dirname, relativePath);
      const childAsset = await createBundleAsset(absolutePath);
      asset.mapping[relativePath] = childAsset.id;
      queue.push(childAsset);
    });
  }

  return queue;
}

function bundle(graph: Asset[]) {
  let modules = "";
  graph.forEach((mod) => {
    modules += `${mod.id}: [
    function (require, module, exports) {
  ${mod.code}
  }
    ,
  ${JSON.stringify(mod.mapping)}
    ],`;
  });

  return `(function(modules) {
      function require(id) {
        const [fn, mapping] = modules[id];

        function localRequire(name) {
          return require(mapping[name]);
        }

        const module = { exports : {} };

        fn(localRequire, module, module.exports);

        return module.exports;
      }

      require(0);
    })({${modules}})
  `;
}
