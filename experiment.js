const fs = require("fs");
const path = require("path");

const vueParser = require("vue-sfc-parser");
const babelParser = require("@babel/parser");

// kind of in the spirit of a data class in python - just want to have a little record
// of the expected structure of these doodads
class OneImport {
  // ** For an import like
  // import TertiaryNav from "client/components/tertiary-nav.vue";
  // `name` is TertiaryNav and `source` is the file name. (Note that
  // `source` might be a package name, as in `import Vue from "vue"`.)
  constructor(args) {
    this.identifier = args.identifier;
    this.source = args.source;
  }
}

class VueComponent {
  constructor(args) {
    this.name = args.name;
    this.components = args.components;
    // since export defaults may be aliased on import, the source of truth is not the
    // name of the component being imported but its location.
    this.file = args.file;
  }
}

function walkRepo(root) {
  function storeOrTraverse(entry, vuePaths, dirPath) {
    const filePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkDir(filePath, vuePaths);
    }
    if (entry.isFile() && entry.name.endsWith(".vue")) {
      vuePaths.push(filePath);
    }
  }
  function walkDir(dirPath, vuePaths) {
    const paths = fs.readdirSync(dirPath, { withFileTypes: true });
    paths.forEach((filePath) => storeOrTraverse(filePath, vuePaths, dirPath));
    return vuePaths;
  }
  const vuePaths = [];
  return walkDir(root, vuePaths);
}

function readCode(fileName) {
  return fs.readFileSync(fileName, "utf8");
}

function findComponent(scriptAST) {
  // we always `export default` our Vue components so find that
  const exportNode = scriptAST.program.body.find(
    (node) => node.type === "ExportDefaultDeclaration"
  );
  let vueArgs;
  if (exportNode.declaration.type === "ObjectExpression") {
    // sometimes we skip "Vue.extends ..." and export an object
    // `export default {name: "SomeComponent", components: {...}}
    vueArgs = exportNode.declaration;
  } else if (exportNode.declaration.type === "Identifier") {
    // handle the form `export default SomeComponentDefinedEarlier`
    // by walking the ast for the earlier definition
    const component = scriptAST.program.body.find(
      (node) =>
        node.type === "VariableDeclaration" &&
        node.declarations[0].id.name === exportNode.declaration.name
    );
    // todo: I think this only handles the case where the previous definition
    // uses Vue.extend, not the case where it's a bare object
    debugger;
    vueArgs = component.declarations[0].init.arguments[0];
  } else {
    // export default Vue.extend({...})
    vueArgs = exportNode.declaration.arguments[0];
  }
  // At this point we want to parse the object that's passed as an argument to Vue.extends,
  // taking the form {name: "MyCoolComponent", components: {MyCoolSubComponent, MyOtherSubComponent}}
  // although note that name or components (or both) may be missing
  const nameProp = vueArgs.properties.find(
    (property) => property.key.name == "name"
  );
  const name = nameProp ? nameProp.value.value : null;
  const componentsProp = vueArgs.properties.find(
    (property) => property.key.name == "components"
  );
  const componentsUsed = componentsProp
    ? componentsProp.value.properties.map((node) => node.value.name)
    : null;
  return {
    name: name,
    components: componentsUsed,
  };
}

function parseFile(fileName, fileContents) {
  const component = vueParser.parseComponent(fileContents);
  const scriptAST = babelParser.parse(component.script.content, {
    sourceType: "module",
    plugins: ["typescript", "classProperties"],
  });
  const parsedImports = scriptAST.program.body.filter(
    (node) => node.type === "ImportDeclaration"
  );
  const imports = parsedImports
    .filter((node) => node.specifiers.length)
    .map(
      (node) =>
        new OneImport({
          identifier: node.specifiers[0].local.name,
          source: node.source.value,
        })
    );
  const componentData = findComponent(scriptAST);
  return new VueComponent({
    name: componentData.name,
    components: componentData.components
      ? componentData.components.map((comp) =>
          imports.find((each) => each.identifier === comp)
        )
      : [],
    file: fileName,
  });
}

function parseAll() {
  // todo: home expansion / get the root a reasonable way
  const rootDir = "/Users/akaptur/src/pilot/connections/";
  const vueFiles = walkRepo(rootDir);
  const allComponents = []; // todo useful data structure
  vueFiles.forEach((fileName) => {
    try {
      const fileContents = readCode(fileName);
      allComponents.push(parseFile(fileName, fileContents));
    } catch (error) {
      // for debugging: log the files with problems
      console.log(fileName);
      // console.log(error);
    }
  });
  return allComponents;
}

function parseOne(fileName) {
  const fileContents = readCode(fileName);
  return parseFile(fileName, fileContents);
}

parseAll();

// for the benefit of Jest
// (why is this necessary?)
exports.parseFile = parseFile;
exports.OneImport = OneImport;
exports.VueComponent = VueComponent;
