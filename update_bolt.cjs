const fs = require('fs');
const file = '.jules/bolt.md';

let content = '';
if (fs.existsSync(file)) {
    content = fs.readFileSync(file, 'utf8') + '\n';
}

content += `## 2024-04-22 - Admin Page Tabs Memoization
**Learning:** React components that compute derived arrays on every render (like filtering tabs based on permissions) can cause unnecessary work. This is especially true when passing callbacks from context (\`hasPermission\`) inside the filter function.
**Action:** Always wrap computationally derived arrays (filtering, mapping, reducing) in \`useMemo\` when the output depends on props or context that rarely changes. Ensure the dependency array accurately reflects the variables used inside the memoized function.`;

fs.writeFileSync(file, content);
