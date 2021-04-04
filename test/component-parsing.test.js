var m = require("../experiment.js");

function makeVue(script) {
  return `
<template></template>
<script>
import CoolSubStuff from 'cool/path.vue';
import JankySubStuff from 'janky.vue';
${script}
</script>`;
}

debugger;
// matching the imports above
const COMPONENTS = [
  new m.OneImport({ identifier: "CoolSubStuff", source: "cool/path.vue" }),
  new m.OneImport({ identifier: "JankySubStuff", source: "janky.vue" }),
];
const FILENAME = "myfile.vue";

describe("Parse Vue components in all their various forms", () => {
  it("Can handle normal cases", () => {
    const code = makeVue(
      `export default Vue.extend({name: 'CoolStuff', components: {CoolSubStuff, JankySubStuff}, props: {}});`
    );
    expect(m.parseFile(FILENAME, code)).toEqual(
      new m.VueComponent({
        name: "CoolStuff",
        components: COMPONENTS,
        file: FILENAME,
      })
    );
  });
  it("Allows missing names", () => {
    const code = makeVue(
      `export default Vue.extend({components: {CoolSubStuff, JankySubStuff}, props: {}});`
    );
    expect(m.parseFile(FILENAME, code)).toEqual(
      new m.VueComponent({
        name: null,
        components: COMPONENTS,
        file: FILENAME,
      })
    );
  });
  it("Allows empty/no components", () => {
    const code = makeVue(
      `export default Vue.extend({name: "Simple"});`
    );
    expect(m.parseFile(FILENAME, code)).toEqual(
      new m.VueComponent({
        name: "Simple",
        components: [],
        file: FILENAME,
      })
    );
  });
  it("Allows bare objects without Vue.extends", () => {
    const code = makeVue(
      `export default {name: "CoolStuff", components: {CoolSubStuff, JankySubStuff}, props: {}});`
    );
    expect(m.parseFile(FILENAME, code)).toEqual(
      new m.VueComponent({
        name: "CoolStuff",
        components: COMPONENTS,
        file: FILENAME,
      })
    );

  });
});
