const fs = require('fs');

const { parseComponent } = require("vue-sfc-parser");

const code = fs.readFileSync("/Users/akaptur/src/pilot/connections/client/views/admin/customer-chart-of-accounts-nav.vue", 'utf8');
const parsed = parseComponent(code);
console.log(parsed);
debugger;