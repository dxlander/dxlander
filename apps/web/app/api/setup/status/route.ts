import { NextResponse } from 'next/server';

/**
 * API Route to check setup status
 * This mimics what the backend /setup/status endpoint would return
 * For now, we'll implement basic logic here
 */

export async function GET() {
  try {
    // In production, this would check:
    // 1. Database existence and connection
    // 2. Admin user existence
    // 3. Basic configuration completeness

    // For MVP, we'll simulate the check
    // Always return setup incomplete for now so users see the setup wizard
    const isSetupComplete = false;

    // TODO: Implement actual setup detection
    // const hasDatabase = await checkDatabaseExists()
    // const hasAdminUser = await checkAdminUserExists()
    // const isSetupComplete = hasDatabase && hasAdminUser

    return NextResponse.json({
      setupComplete: isSetupComplete,
      hasAdminUser: false,
      databaseConnected: true,
      instanceId: null,
      message: isSetupComplete ? 'Setup is complete' : 'Setup required',
    });
  } catch (error) {
    console.error('Setup status check failed:', error);

    // If there's an error checking setup, assume setup is needed
    return NextResponse.json(
      {
        setupComplete: false,
        hasAdminUser: false,
        databaseConnected: false,
        instanceId: null,
        message: 'Setup required due to configuration error',
      },
      { status: 200 }
    ); // Return 200 so frontend handles gracefully
  }
}
