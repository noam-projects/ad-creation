"use client";

import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function SettingsDialog() {
    const [open, setOpen] = useState(false);
    const [keys, setKeys] = useState({
        OPENAI_API_KEY: "",
        ELEVENLABS_API_KEY: "",
        GEMINI_API_KEY: "",
        PEXELS_API_KEY: "",
        USE_GPU: false,
    });
    const [status, setStatus] = useState({
        hasOpenAI: false,
        hasElevenLabs: false,
        hasGemini: false,
        hasPexels: false,
    });

    const checkStatus = async () => {
        try {
            const res = await fetch("/api/settings");
            const data = await res.json();
            setStatus(data);
            setKeys(prev => ({ ...prev, USE_GPU: data.useGpu }));

            if (data.dbConnected === false) {
                toast.error("Database Connection Failed!", {
                    description: "Could not connect to Supabase. Check your internet connection."
                });
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to load settings");
        }
    };

    useEffect(() => {
        if (open) {
            checkStatus();
        }
    }, [open]);

    const handleSave = async () => {
        try {
            await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(keys),
            });
            toast.success("Settings saved successfully");
            setOpen(false);
            checkStatus(); // Refresh status
            // Reload page to ensure next.js picks up changes if needed, but wait for toast
            setTimeout(() => window.location.reload(), 1000);
        } catch (error) {
            console.error("Failed to save settings", error);
            toast.error("Failed to save settings");
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Settings className="mr-2 h-4 w-4" /> Settings
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                    <DialogDescription>
                        Configure your API keys. Keys are saved locally to .env.local.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="openai">OpenAI API Key</Label>
                        <Input
                            id="openai"
                            type="password"
                            placeholder={status.hasOpenAI ? "******** (Set)" : "sk-..."}
                            value={keys.OPENAI_API_KEY}
                            onChange={(e) => setKeys({ ...keys, OPENAI_API_KEY: e.target.value })}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="gemini">Gemini API Key (Required)</Label>
                        <Input
                            id="gemini"
                            type="password"
                            placeholder={status.hasGemini ? "******** (Set)" : "AIza..."}
                            value={keys.GEMINI_API_KEY}
                            onChange={(e) => setKeys({ ...keys, GEMINI_API_KEY: e.target.value })}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="elevenlabs">ElevenLabs API Key</Label>
                        <Input
                            id="elevenlabs"
                            type="password"
                            placeholder={status.hasElevenLabs ? "******** (Set)" : "..."}
                            value={keys.ELEVENLABS_API_KEY}
                            onChange={(e) => setKeys({ ...keys, ELEVENLABS_API_KEY: e.target.value })}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="pexels">Pexels API Key (Required for Stock)</Label>
                        <Input
                            id="pexels"
                            type="password"
                            placeholder={status.hasPexels ? "******** (Set)" : "..."}
                            value={keys.PEXELS_API_KEY}
                            onChange={(e) => setKeys({ ...keys, PEXELS_API_KEY: e.target.value })}
                        />
                    </div>
                    <div className="flex items-center space-x-2 pt-2 border-t mt-4">
                        <input
                            type="checkbox"
                            id="gpu"
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            checked={keys.USE_GPU}
                            onChange={(e) => setKeys({ ...keys, USE_GPU: e.target.checked })}
                        />
                        <Label htmlFor="gpu" className="font-medium cursor-pointer">
                            Enable GPU Acceleration (Radeon RX 570)
                        </Label>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
