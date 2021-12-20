import FileHound from "filehound";
import { promises as fs } from "fs";
import path from "path";
import { promisify } from "util";
//
// const packages = await FileHound.create()
//   .paths(`packages`)
//   .directory()
//   .depth(1)
//   .find();

const buildPaths = ['esnext']

for (const buildPath of buildPaths) {
  const filePaths = await FileHound.create()
    .paths(buildPath)
    .discard("node_modules")
    .ext("js")
    .find()

  await Promise.all(
    filePaths.map(
      async filePath => {

          const initialContents = await fs.readFile(
              filePath,
              "utf-8"
          );

          const statements = initialContents.match(/(?:(?:import|export)(?: .+ from)? ".+";|(?:import\(".+"\)))/g);

          if (!statements) {
              return;
          }

          const importMap = process.env.IMPORT_MAP ? JSON.parse(await fs.readFile(process.env.IMPORT_MAP, "utf-8")) : undefined;
          const contents = await statements.reduce(
              async (contentsPromise, statement) => {
                  const contents = await contentsPromise;
                  const url = statement.match(/"(.+)"/)[1];
                  if (importMap?.imports?.[url]) {
                      const replacement = importMap.imports[url];
                      if (!replacement.includes("./src")) {
                          return contents.replace(
                              statement,
                              statement.replace(url, replacement)
                          );
                      }
                      const shift = filePath
                          .split("/")
                          // Skip top folder + file
                          .slice(2)
                          // Replace with shift up directory
                          .map(() => "..")
                          .join("/");
                      return contents.replace(
                          statement,
                          statement.replace(url, replacement.replace("./src", shift).replace(/\.tsx?$/, ".js"))
                      );
                  } else {
                      return contents.replace(
                          statement,
                          await getReplacement(url)
                      );
                  }

                  async function getReplacement(url) {
                      const [stat, indexStat] = await Promise.all([
                          fs.stat(path.resolve(path.dirname(filePath), url + ".js")).catch(() => {}),
                          fs.stat(path.resolve(path.dirname(filePath), url + "/index.js")).catch(() => {})
                      ]);

                      if (stat && stat.isFile()) {
                          return statement.replace(url, url + ".js");
                      } else if (indexStat && indexStat.isFile()) {
                          return statement.replace(url, url + "/index.js");
                      }
                      return statement;
                  }
              },
              Promise.resolve(initialContents)
          );

          await fs.writeFile(filePath, contents, "utf-8");

      }
    )
  );
}

