const fs = require('fs');

const code = fs.readFileSync("/Users/akaptur/src/pilot/connections/client/views/admin/customer-chart-of-accounts-nav.vue", 'utf8');
const parsed = parseComponent(code);
console.log(parsed);
debugger;