const fs = require("fs");

const { parseComponent } = require("vue-sfc-parser");
const babelParser = require("@babel/parser");

function readCode() {
    // this function should eventually read the full repo
    return fs.readFileSync(
      "/Users/akaptur/src/pilot/connections/client/views/admin/customer-chart-of-accounts-nav.vue",
      "utf8"
    );
}

function findImports(fileContents) {
    const component = parseComponent(fileContents);
    const scriptAST = babelParser.parse(component.script.content, {
      sourceType: "module",
    });
    console.log(scriptAST.program.body);
    const imports = scriptAST.program.body.filter(
      (node) => node.type === "ImportDeclaration"
    );
    return imports.map((node) => ({name: node.specifiers[0].local.name, file: node.source.value}));
}

const fileContents = readCode();
const parsedImports = findImports(fileContents);
console.log(parsedImports);