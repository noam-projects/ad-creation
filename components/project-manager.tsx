"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { SettingsDialog } from "./settings-dialog";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

interface Project {
    id: string;
    name: string;
    masterPrompt: string;
}

interface ProjectManagerProps {
    onSelectProject: (project: Project) => void;
    selectedProjectId?: string;
}

export function ProjectManager({ onSelectProject, selectedProjectId }: ProjectManagerProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newProject, setNewProject] = useState({ name: "", masterPrompt: "" });

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const res = await fetch("/api/projects");
            const data = await res.json();
            setProjects(data);
        } catch (error) {
            console.error("Failed to fetch projects", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        try {
            const res = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newProject),
            });
            if (res.ok) {
                const project = await res.json();
                setProjects([...projects, project]);
                setIsCreating(false);
                setNewProject({ name: "", masterPrompt: "" });
                onSelectProject(project);
            }
        } catch (error) {
            console.error("Failed to create project", error);
        }
    };

    const startEdit = (project: Project) => {
        setIsEditing(true);
        setEditingId(project.id);
        setNewProject({ name: project.name, masterPrompt: project.masterPrompt });
        setIsCreating(true); // Reuse the creation card
    };

    const handleUpdate = async () => {
        if (!editingId) return;
        try {
            const res = await fetch("/api/projects", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: editingId, ...newProject }),
            });
            if (res.ok) {
                const updated = await res.json();
                setProjects(projects.map(p => p.id === editingId ? updated : p));

                // If the updated project was selected, update parent's view too
                if (selectedProjectId === editingId) {
                    onSelectProject(updated);
                }

                cancelEdit();
            }
        } catch (error) {
            console.error("Failed to update", error);
        }
    };

    const cancelEdit = () => {
        setIsCreating(false);
        setIsEditing(false);
        setEditingId(null);
        setNewProject({ name: "", masterPrompt: "" });
    }

    const deleteProject = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this project?")) return;
        try {
            const res = await fetch(`/api/projects?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setProjects(projects.filter(p => p.id !== id));
            }
        } catch (error) {
            console.error("Failed to delete", error);
        }
    }

    // Alias for template compatibility if needed, but best to use deleteProject directly
    const handleDelete = deleteProject;

    return (
        <div className="space-y-4">
            <div className="flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Projects</h2>
                </div>
                <div className="flex items-center space-x-2">
                    <SettingsDialog />
                    <Button size="sm" className="flex-1" onClick={() => { cancelEdit(); setIsCreating(!isCreating); }}>
                        <Plus className="mr-2 h-4 w-4" /> New Project
                    </Button>
                </div>
            </div>

            {isCreating && (
                <Card className="mb-4 bg-secondary/20">
                    <CardHeader>
                        <CardTitle>{isEditing ? "Edit Project" : "Create Project"}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Project Name</Label>
                            <Input
                                value={newProject.name}
                                onChange={(e) =>
                                    setNewProject({ ...newProject, name: e.target.value })
                                }
                                placeholder="e.g. Crypto Ads"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Master Prompt</Label>
                            <Textarea
                                value={newProject.masterPrompt}
                                onChange={(e) =>
                                    setNewProject({ ...newProject, masterPrompt: e.target.value })
                                }
                                placeholder="Enter master prompt that would let the AI know exactly what to generate the ad for..."
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="justify-end space-x-2">
                        <Button variant="ghost" onClick={cancelEdit}>
                            Cancel
                        </Button>
                        <Button onClick={isEditing ? handleUpdate : handleCreate}>
                            {isEditing ? "Save Changes" : "Create"}
                        </Button>
                    </CardFooter>
                </Card>
            )}

            <div className="grid gap-4">
                {loading ? (
                    <div>Loading projects...</div>
                ) : projects.length === 0 ? (
                    <div className="text-muted-foreground text-sm">No projects found.</div>
                ) : (
                    projects.map((project) => (
                        <Card
                            key={project.id}
                            className={`cursor-pointer transition-colors hover:bg-accent ${selectedProjectId === project.id ? "border-primary bg-accent" : ""
                                }`}
                            onClick={() => onSelectProject(project)}
                        >
                            <CardHeader className="flex flex-row items-center justify-between p-4 space-y-0">
                                <div>
                                    <CardTitle className="text-base">{project.name}</CardTitle>
                                    <CardDescription className="line-clamp-1 text-xs mt-1">
                                        {project.masterPrompt}
                                    </CardDescription>
                                </div>
                                <div className="flex space-x-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); startEdit(project); }}>
                                        <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={(e) => handleDelete(e, project.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
