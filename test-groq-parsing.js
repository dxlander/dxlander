const testContent = `<write_file>
<path>Dockerfile</path>
<content># Multi-stage Dockerfile for Next.js 14 application

# Optimized for speed with aggressive caching

FROM node:18-alpine AS base
# ... rest of Dockerfile content ...
</content>
</write_file>

<write_file>
<path>.dockerignore</path>
<content># Dependencies
node_modules
npm-debug.log*
# ... rest of dockerignore content ...
</content>
</write_file>

<write_file>
<path>.env.example</path>
<content># Stellar Blockchain Configuration
NEXT_PUBLIC_STELLAR_NETWORK=testnet
# ... rest of env.example content ...
</content>
</write_file>

<write_file>
<path>_summary.json</path>
<content>{
  "configType": "docker",
  "projectSummary": {
    "overview": "A decentralized reputation system frontend",
    "framework": "Next.js 14",
    "runtime": "Node.js 18",
    "buildTool": "npm",
    "isMultiService": false,
    "services": ["main app"],
    "mainPort": 3000
  }
}
</content>
</write_file>`;

// Test the regex pattern
const writeFileTagMatches = testContent.matchAll(
  /<write_file>\s*<path>([^<]+)<\/path>\s*<content>([\s\S]*?)<\/content>\s*<\/write_file>/g
);
const writeFileTagFiles = Array.from(writeFileTagMatches).map((match) => {
  const typedMatch = match;
  return {
    fileName: typedMatch[1].trim(),
    content: typedMatch[2].trim(),
  };
});

console.log('Found files:', writeFileTagFiles.length);
writeFileTagFiles.forEach((f) => console.log('-', f.fileName));

// Test the existing patterns too
const writeTagMatches = testContent.matchAll(
  /<write>\s*<path>([^<]+)<\/path>\s*<content>([\s\S]*?)<\/content>\s*<\/write>/g
);
const writeTagFiles = Array.from(writeTagMatches).map((match) => {
  const typedMatch = match;
  return {
    fileName: typedMatch[1].trim(),
    content: typedMatch[2].trim(),
  };
});

console.log('Found <write> files:', writeTagFiles.length);
