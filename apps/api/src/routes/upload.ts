import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import {
  extractZipFile,
  validateZipFile,
  generateSourceHash,
  generateRandomProjectName,
  validateProjectName,
} from '@dxlander/shared';
import { db, schema } from '@dxlander/database';
import { eq, and } from 'drizzle-orm';

type Variables = {
  user: { id: string; email: string; role: string };
};

const upload = new Hono<{ Variables: Variables }>();

/**
 * POST /upload/zip
 * Upload and extract ZIP file
 */
upload.post('/zip', async (c) => {
  try {
    // Get form data
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const projectName = formData.get('projectName') as string | null;

    if (!file) {
      return c.json({ success: false, error: 'No file uploaded' }, 400);
    }

    // Validate file is a ZIP
    if (!file.name.endsWith('.zip')) {
      return c.json({ success: false, error: 'File must be a ZIP archive' }, 400);
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate ZIP file
    const validation = validateZipFile(buffer);
    if (!validation.valid) {
      return c.json({ success: false, error: validation.error }, 400);
    }

    // Get user from auth context (set by auth middleware)
    const user = c.get('user') as { id: string; email: string; role: string };
    const userId = user.id;

    // Generate or validate project name
    let finalProjectName: string;
    if (!projectName || projectName.trim() === '') {
      finalProjectName = generateRandomProjectName();
    } else {
      finalProjectName = projectName.trim();
      const nameValidation = validateProjectName(finalProjectName);
      if (!nameValidation.valid) {
        return c.json({ success: false, error: nameValidation.error }, 400);
      }
    }

    // Create project ID
    const projectId = randomUUID();

    console.log(
      `📦 Extracting ZIP file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`
    );

    // Extract ZIP file
    const extractResult = await extractZipFile(buffer, projectId);

    console.log(
      `✅ Extracted ${extractResult.filesCount} files (${(extractResult.totalSize / 1024 / 1024).toFixed(2)} MB)`
    );

    // Generate source hash
    const sourceHash = generateSourceHash(`zip-${file.name}`, 'default');

    // Check for duplicates (by file name - simple approach)
    const existingProject = await db.query.projects.findFirst({
      where: and(eq(schema.projects.userId, userId), eq(schema.projects.sourceHash, sourceHash)),
    });

    if (existingProject) {
      return c.json(
        {
          success: false,
          error: `A project with this ZIP file has already been imported as "${existingProject.name}"`,
        },
        409
      );
    }

    // Create project record in database
    const projectData = {
      id: projectId,
      userId,
      name: finalProjectName,
      description: `Imported from ${file.name}`,
      sourceType: 'zip' as const,
      sourceUrl: file.name,
      sourceHash,
      localPath: extractResult.localPath,
      filesCount: extractResult.filesCount,
      projectSize: extractResult.totalSize,
      status: 'imported' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(schema.projects).values(projectData);

    console.log(
      `✅ Imported "${finalProjectName}" - ${extractResult.filesCount} files (${(extractResult.totalSize / 1024 / 1024).toFixed(2)} MB)`
    );

    // Return success response
    return c.json({
      success: true,
      project: projectData,
      metadata: {
        filesCount: extractResult.filesCount,
        totalSize: extractResult.totalSize,
        localPath: extractResult.localPath,
      },
    });
  } catch (error: any) {
    console.error('ZIP upload failed:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to upload ZIP file',
      },
      500
    );
  }
});

export default upload;
