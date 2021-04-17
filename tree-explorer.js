const fs = require("fs");
const path = require("path");
const yargs = require("yargs");

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

function parseAll(repo_dir) {
  const vueFiles = walkRepo(repo_dir);
  const allComponents = [];
  vueFiles.forEach((fileName) => {
    const fileContents = readCode(fileName);
    try {
      allComponents.push(parseFile(fileName, fileContents));
    } catch (error) {
      // for debugging: log the files with problems
      console.log(fileName);
      // console.log(error);
    }
  });
  return allComponents;
}

// Similar to VueComponent above, but populating the linked components with
// an actual refernce to another node instead of an import
class ComponentNode {
  constructor(vueComp, relativePath) {
    this.vueComp = vueComp;
    this.relativePath = relativePath;
    this.children = [];
    this.parents = [];
  }
}

function buildGraph(components, root) {
  const graph = new Map();
  // first pass: build a map keyed off of relative path.
  components.forEach((component) => {
    // because imports can be aliased, it's the file that
    // canonically identifies a component.
    const usefulPath = path.relative(root, component.file);
    graph.set(usefulPath, new ComponentNode(component, usefulPath));
  });
  // second pass: populate the parents
  graph.forEach((component, relativePath) => {
    component.vueComp.components.forEach((child) => {
      if (!child) {
        // todo: documentation-pointers.vue parsing
        // console.log(component.vueComp.file);
        return;
      }
      const childNode = graph.get(child.source);
      if (!childNode) {
        // todo: relative imports :/
        // console.log(child.source, component.vueComp.file);
        return;
      }
      component.children.push(childNode);
      childNode.parents.push(component);
    });
  });
  return graph;
}

function forVisJS(graph) {
  // take the output of buildGraph
  // now smash it into a format vis.js likes
  const serializedGraph = { nodes: [], links: [] };
  graph.forEach((node) => {
    serializedGraph.nodes.push({
      id: node.relativePath,
      label: node.vueComp.name,
    });
    node.children.forEach((child) => {
      serializedGraph.links.push({
        from: node.relativePath,
        to: child.relativePath,
      });
    });
  });
  return serializedGraph;
}

function displayPaths(compName, graph) {
  // naive iteration here, but probably dwarfed by the file I/O anyway
  const matchingComps = Array.from(graph.values()).filter(
    (component) => component.vueComp.name === compName
  );
  if (matchingComps.length > 1) {
    console.log("More than one component found!");
    matchingComps.forEach((fileName, component) => {
      console.log(fileName);
    });
    return
  }
  if (matchingComps.length === 0) {
    console.log("No component found");
    return
  }
  const match = matchingComps[0];
  // Now walk each tree and print the parents
  const paths = buildPaths(match);
  console.log(compName, "used in:");
  paths.forEach((path) => {
      console.log(path.map((comp) => comp.vueComp.name).join("->"));
  })
}

function buildPaths(startNode) {
  // given a dependency graph like
  //         A     F
  //       /  \  /
  //      B    C
  //     / \ /
  //    E   D
  //
  // if asked for D, return all paths
  // to the roots: DBA, DCA, and DCF.
  const sentinel = "<sentinel-end>";
  function logParent(soFar) {
    const last = soFar[soFar.length - 1];
    if (last.parents.length === 0) {
        // root is reached
        soFar.push(sentinel)
        return [soFar];
    }
    const out = [];
    last.parents.forEach((parent) => {
      const nextStep = [...soFar];
      nextStep.push(parent);
      out.push(nextStep);
    });
    return out;
  }
  var paths = [[startNode]];
  while (paths.some((path) => path[path.length -1] !== sentinel)) {
      newPaths = [];
      paths.forEach((path) => {
        if (path[path.length - 1] !== sentinel) {
          newPaths.push(...logParent(path));
        } else {
            newPaths.push(path);
        }
      })
      paths = newPaths;
  }
  // pop off all the sentinels before returning
  paths.forEach((path) => path.pop());
  return paths;
}

function writeGraph(graph) {
  const dumped = JSON.stringify(graph);
  fs.writeFileSync("component_graph.json", dumped);
}

function parseOne(fileName) {
  const fileContents = readCode(fileName);
  return parseFile(fileName, fileContents);
}

function main() {
  args = yargs(process.argv).argv;
  const allComponents = parseAll(args.repo);
  const graph = buildGraph(allComponents, args.repo);
  const searchTarget = args.component;
  displayPaths(searchTarget, graph);
}
main();



// writeGraph(graph);

// for the benefit of Jest
// (why is this necessary?)
exports.parseFile = parseFile;
exports.OneImport = OneImport;
exports.VueComponent = VueComponent;
