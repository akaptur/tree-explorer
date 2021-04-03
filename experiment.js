const fs = require("fs");
const path = require("path");

const { parseComponent } = require("vue-sfc-parser");
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
      // sometimes we export a bare object rather than "Vue.extends ..."
      // in which case just grab it
      vueArgs = exportNode.declaration;
  } else {
    vueArgs = exportNode.declaration.arguments[0];
  }
  // At this point we want to parse the object that's passed as an argument to Vue.extends,
  // taking the form {name: "MyCoolComponent", components: {MyCoolSubComponent, MyOtherSubComponent}}
  // sadly not all components have names
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

function parseFile(fileName) {
  const fileContents = readCode(fileName);
  const component = parseComponent(fileContents);
  const scriptAST = babelParser.parse(component.script.content, {
    sourceType: "module",
  });
  const parsedImports = scriptAST.program.body.filter(
    (node) => node.type === "ImportDeclaration"
  );
  const imports = parsedImports.map(
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
    const rootDir = "/Users/akaptur/src/pilot/connections/";
    const vueFiles = walkRepo(rootDir);
    const allComponents = []; // todo useful data structure
    vueFiles.forEach((fileName) => {
      try {
        allComponents.push(parseFile(fileName));
      } catch (error) {
        // for debugging: log the files with problems
        console.log(fileName);
        console.log(error);
      }
    });
};

parseAll();

// interesting test cases
// accordion (no components)
// something has no name
// ship-nav (no Vue.extends call)
