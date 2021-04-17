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
Pass the path to the target codebase (that is, the one you're examining) as `--repo` and the name of the Vue component you're searching for as `--component`.
Example:
```
$ node tree-explorer.js --repo /path/to/target/repository --component MyComponentName
```

# FAQ
### Is this on npm?
No, it's too rough of a draft at the moment, but you're welcome to clone the repo and try it out.

### Can I contribute?
Sure, although please expect a week or so for feedback on pull requests.
