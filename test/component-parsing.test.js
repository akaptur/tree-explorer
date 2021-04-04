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

function makeTS() {
  return `
<template></template>
<script lang="ts">
import CoolSubStuff from 'cool/path.vue';
import JankySubStuff from 'janky.vue';
import TypeAnnotation from 'loveTypes';
export default {
    name: "CoolStuff",
    components: {CoolSubStuff, JankySubStuff},
    props: {
        type: Object as TypeAnnotation,
        required: true,
    }
};
</script>`;
}

// matching the imports above
const COMPONENTS = [
  new m.OneImport({ identifier: "CoolSubStuff", source: "cool/path.vue" }),
  new m.OneImport({ identifier: "JankySubStuff", source: "janky.vue" }),
];
const FILENAME = "myfile.vue";
const BASIC_VUE = `
export default Vue.extend(
    {name: 'CoolStuff', components: {CoolSubStuff, JankySubStuff}, props: {}});`;

const BASIC_COMPONENT = new m.VueComponent({
  name: "CoolStuff",
  components: COMPONENTS,
  file: FILENAME,
});

describe("Parse Vue components in all their various forms", () => {
  it("Can handle normal cases", () => {
    const code = makeVue(BASIC_VUE);
    expect(m.parseFile(FILENAME, code)).toEqual(BASIC_COMPONENT);
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
    const code = makeVue(`export default Vue.extend({name: "Simple"});`);
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
      `export default {name: "CoolStuff", components: {CoolSubStuff, JankySubStuff}, props: {}};`
    );
    expect(m.parseFile(FILENAME, code)).toEqual(BASIC_COMPONENT);
  });

  it("Tolerates typescript", () => {
    const code = makeTS();
    expect(m.parseFile(FILENAME, code)).toEqual(BASIC_COMPONENT);
  });

  it("Can handle a bare import", () => {
    const code = makeVue(`import "@testing-library/jest-dom"` + BASIC_VUE);
    expect(m.parseFile(FILENAME, code)).toEqual(BASIC_COMPONENT);
  });

  it("Parses classes with properties", () => {
    const code = makeVue(
      `class Foo { prop; prop2; }
       export default Vue.extend({name: "CoolStuff", components: {CoolSubStuff, JankySubStuff}, props: {}});`
    );
    expect(m.parseFile(FILENAME, code)).toEqual(BASIC_COMPONENT);
  });

  it("Allows objects that are named", () => {
    const code = makeVue(
      `const CoolStuff = Vue.extend(
            {name: "CoolStuff", components: {CoolSubStuff, JankySubStuff}, props: {}}
        )
        export default CoolStuff`
    );
    expect(m.parseFile(FILENAME, code)).toEqual(BASIC_COMPONENT);
  });
});
