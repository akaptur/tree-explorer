const fs = require("fs");

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

function readCode(fileName) {
  return fs.readFileSync(fileName, "utf8");
}

function findComponent(scriptAST) {
  // we always `export default` our Vue components so find that
  // a more rigorous approach would look for Vue.extends specifically
  const exportNode = scriptAST.program.body.find(
    (node) => node.type === "ExportDefaultDeclaration"
  );
  const vueArgs = exportNode.declaration.arguments[0];
  // At this point we want to parse the object that's passed as an argument to Vue.extends,
  // taking the form {name: "MyCoolComponent", components: {MyCoolSubComponent, MyOtherSubComponent}}
  const vueCompName = vueArgs.properties.find(
    (property) => property.key.name == "name"
  ).value.value;
  const componentsUsed = vueArgs.properties
    .find((property) => property.key.name == "components")
    .value.properties.map((node) => node.value.name);
  return {
    name: vueCompName,
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
    components: componentData.components.map((comp) =>
      imports.find((each) => each.identifier === comp)
    ),
    file: fileName,
  });
}

const fileName =
  "/Users/akaptur/src/pilot/connections/client/views/admin/customer-chart-of-accounts-nav.vue";
const component = parseFile(fileName);
console.log(component);
