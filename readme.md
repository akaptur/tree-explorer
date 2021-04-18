# Vue Component Tree Explorer

Tree Explorer is a tool to help a Vue programmer understand where a given component is used in their app.

The strategy has four steps:
1. Read in the Vue files and parse them
2. Extract the Vue components and imports from the Javascript AST
3. Build a graph of the (explicit) component relationship
4. Visualize the graph as desired

Tree explorer doesn't replace the Vue dev tools - it's intended to be used alongside them. The Vue dev tools are an excellent way to see the Vue component hierarchy at run time for a given page. Tree Explorer operates on similar data, with two differences:
- It's a static analysis tool, so it doesn't require your code to run.
- It covers the entire app, not just a single page that you happen to be looking at, so you can understand what other surfaces in your app might be affected by changes in a component.

# Usage
## Parsing and command line output
Pass the path to the target codebase (that is, the one you're examining) as `--repo` and the name of the Vue component you're searching for as `--component`.
Example:
```
$ node tree-explorer.js --repo /path/to/target/repository --component MyComponentName
```
Example output:
```
MyComponentName -> X -> Y -> Z
MyComponentName -> X -> Y -> W
MyComponentName -> V
```

This output displays one line per distinct path to a root component, where a root component is one not used by any other component. (In our app, root components are overwhelmingly used by the router.)

The "distinct path" strategy produces verbose output and duplicates some information. For example, suppose we have the following dependency graph:
```
       A     F
     /  \  /
    B    C
   / \ /
  E   D
```
A search for "D" would return all paths back to the roots:
```
D -> B -> A
D -> C -> A
D -> C -> F
```

## Visualization
In addition to command-line output, running the command above outputs a file called `component_graph.json`. `view.html` can read this file and display it with vis.js. To see inspect it, fire up the server of your choice:
```
$ python -m SimpleHTTPServer  # or any other server
```
and then open the file in the browser (e.g. http://localhost:8000/view.html)

This visualization shows the entire filtered graph of nodes, which can be messy for components with many callers. I'm planning to experiment with more usable visualizations.

## Limitations
- There are a handful of known issues around parsing, including relative imports and imports of more than one thing from a component file.
- The tool tracks only explicit relationships - if you use global Vue components directly in templates, the current version of tree-explorer won't capture that.
- It's likely that you'll have to edit the arguments to babel parser's `parse` call - today, this is tuned to match the codebase I'm specifically targeting. Look in your babel.config.js file for hints.
# FAQ
### Is this on npm?
No, it's too rough of a draft at the moment, but you're welcome to clone the repo and try it out.

### Can I contribute?
Sure, although please expect a week or so for feedback on pull requests.
