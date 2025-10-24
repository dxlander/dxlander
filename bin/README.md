# DXLander CLI Scripts

This directory contains CLI entry points for DXLander.

## Files

### `dxlander.js`
- **Purpose**: Production CLI used in the distributed npm package
- **Used by**: End users who install via `npm install -g dxlander`
- **Copied to**: `dist-production/bin/dxlander` during build
- **Runs**: Both API and Web servers in production mode using Node.js directly

## Development vs Production

### Development Mode
- Use `pnpm dev` from the repository root
- Runs both apps in watch mode with hot reload
- No CLI script needed

### Production Mode (npm package)
- Users run `dxlander` command after global install
- Executes `bin/dxlander-production.js` (copied as `bin/dxlander`)
- Spawns both API and Web Node.js servers

## Build Process

The production build script (`scripts/build-production.mjs`):
1. Copies `bin/dxlander.js` → `dist-production/bin/dxlander`
2. Makes it executable (chmod +x)
3. Creates Windows batch file `dxlander.cmd`

## Best Practices

✅ **DO**: Edit `dxlander.js` for CLI changes  
✅ **DO**: Use `pnpm dev` for development  
❌ **DON'T**: Embed CLI code as strings in build scripts  
❌ **DON'T**: Create separate development CLI files
