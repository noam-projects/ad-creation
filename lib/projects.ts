import { db } from '@/lib/db';

// LOCAL SYNC TEST: This change should appear in GitHub Desktop "Changes" tab.

export interface Project {
    id: string;
    name: string;
    masterPrompt: string;
    createdAt: string;
}

export async function getProjects(): Promise<Project[]> {
    try {
        const projects = await db.project.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return projects.map(p => ({
            ...p,
            createdAt: p.createdAt.toISOString()
        }));
    } catch (error) {
        console.error("Failed to fetch projects:", error);
        return [];
    }
}

export async function saveProject(project: Project): Promise<Project> {
    // Upsert
    const saved = await db.project.upsert({
        where: { id: project.id },
        update: {
            name: project.name,
            masterPrompt: project.masterPrompt
        },
        create: {
            id: project.id,
            name: project.name,
            masterPrompt: project.masterPrompt,
            createdAt: new Date() // or parse project.createdAt if we trust it? better new Date() for new ones
        }
    });

    return {
        ...saved,
        createdAt: saved.createdAt.toISOString()
    };
}

export async function saveProjects(projects: Project[]): Promise<void> {
    // Not typically used in granular saves, but for compatibility:
    for (const p of projects) {
        await saveProject(p);
    }
}

export async function deleteProject(id: string): Promise<void> {
    try {
        await db.project.delete({
            where: { id }
        });
    } catch (e) {
        // Ignore if already deleted
    }
}
