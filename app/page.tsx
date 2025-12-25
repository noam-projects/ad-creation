"use client";

import { useState } from "react";
import { ProjectManager } from "@/components/project-manager";
import { Generator } from "@/components/generator";

interface Project {
    id: string;
    name: string;
    masterPrompt: string;
}

export default function Home() {
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);

    return (
        <div className="container py-6 max-w-7xl h-[calc(100vh-3.5rem)] flex flex-col">
            <div className="grid grid-cols-12 gap-6 h-full">
                {/* Sidebar */}
                <div className="col-span-12 md:col-span-4 lg:col-span-3 border-r pr-6 h-full overflow-y-auto">
                    <ProjectManager
                        onSelectProject={setSelectedProject}
                        selectedProjectId={selectedProject?.id}
                    />
                </div>

                {/* Main Content */}
                <div className="col-span-12 md:col-span-8 lg:col-span-9 h-full overflow-y-auto">
                    {selectedProject ? (
                        <div className="space-y-6">
                            <div>
                                <h1 className="text-3xl font-bold">{selectedProject.name}</h1>
                                <p className="text-muted-foreground mt-1">Master Prompt: {selectedProject.masterPrompt}</p>
                            </div>
                            <div className="h-px bg-border" />
                            <Generator key={selectedProject.id} project={selectedProject} />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground">
                            <p>Select or create a project to begin.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
