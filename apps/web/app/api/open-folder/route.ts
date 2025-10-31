import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

// Base directory that is allowed to be opened. Configure via env var in development
const BASE_ALLOWED_PATH = process.env.DXLANDER_PROJECTS_PATH || process.cwd();

function isPathAllowed(targetPath: string) {
  try {
    const resolvedBase = path.resolve(BASE_ALLOWED_PATH);
    const resolvedTarget = path.resolve(targetPath);
    return resolvedTarget.startsWith(resolvedBase);
  } catch (e) {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { path: target } = await req.json();

    if (!target || typeof target !== 'string') {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    if (!fs.existsSync(target)) {
      return NextResponse.json({ error: 'Path does not exist' }, { status: 400 });
    }

    if (!isPathAllowed(target)) {
      return NextResponse.json({ error: 'Path is not allowed' }, { status: 403 });
    }

    // Use spawn with args to avoid shell interpolation where possible
    let child;
    if (process.platform === 'win32') {
      // 'start' is a shell builtin, run via cmd
      child = spawn('cmd', ['/c', 'start', '', target], { detached: true, stdio: 'ignore' });
    } else if (process.platform === 'darwin') {
      child = spawn('open', [target], { detached: true, stdio: 'ignore' });
    } else {
      child = spawn('xdg-open', [target], { detached: true, stdio: 'ignore' });
    }

    // Detach so the process can continue after the request completes
    if (child && child.pid) child.unref();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to open folder' }, { status: 500 });
  }
}
