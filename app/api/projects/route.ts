import { NextRequest, NextResponse } from 'next/server';
import { getProjects, saveProject, saveProjects, deleteProject } from '@/lib/projects';

export async function GET() {
    const projects = await getProjects();
    return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { id, name, masterPrompt } = body;

    if (!name || !masterPrompt) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const project = {
        id: id || Math.random().toString(36).substring(7),
        name,
        masterPrompt,
        createdAt: new Date().toISOString(),
    };

    await saveProject(project);
    return NextResponse.json(project);
}

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json(); // Expect { id, name, masterPrompt }
        const projects = await getProjects();
        const index = projects.findIndex((p: any) => p.id === body.id);

        if (index === -1) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        projects[index] = { ...projects[index], ...body };
        await saveProjects(projects);
        return NextResponse.json(projects[index]);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
    }

    await deleteProject(id);
    return NextResponse.json({ success: true });
}
