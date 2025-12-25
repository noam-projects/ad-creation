"use client";

import { useState, useRef, useEffect } from "react";
import { format, getDaysInMonth, startOfMonth, endOfMonth, isBefore, startOfDay, addDays } from "date-fns";
import { Calendar as CalendarIcon, Play, TestTube, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";
import { Input } from "./ui/input";

interface GeneratorProps {
    project: { id: string; name: string };
}

interface Log {
    type: "info" | "success" | "error";
    message: string;
    timestamp: string;
}

export function Generator({ project }: GeneratorProps) {
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1); // 1-indexed
    const [logs, setLogs] = useState<Log[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logs
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    // Check API Status on load - REMOVED per user request
    // Checks are now performed only on action triggers

    const addLog = (type: Log["type"], message: string) => {
        setLogs((prev) => [
            ...prev,
            { type, message, timestamp: new Date().toLocaleTimeString() },
        ]);
    };

    const calculateDays = () => {
        const today = startOfDay(new Date());
        const selectedDate = new Date(year, month - 1);
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);

        // If selected month is in the past entirely, nothing to do (unless user wants past? Assuming future only for "rest of month")
        // Logic: "rest of the month"

        // Determine start day:
        // If selected month is current month, start from tomorrow? Or today? User said "25, program create for 26...". So start from tomorrow if current day.
        // If selected month is Future, start from 1st.
        // If selected month is Past, maybe error or allow backlog? Assuming forward looking.

        let startDate = monthStart;

        // If current month
        if (monthStart.getMonth() === today.getMonth() && monthStart.getFullYear() === today.getFullYear()) {
            startDate = addDays(today, 1);
        }

        // If startDate > monthEnd, then the month is over.
        return { startDate, monthEnd, count: Math.max(0, (monthEnd.getTime() - startDate.getTime()) / (1000 * 3600 * 24) + 1) };
    };

    const handleGenerate = async (isTest: boolean) => {
        setIsGenerating(true);

        // Start with a clean slate and "Checking" message
        const initialLogs: Log[] = [
            { type: "info", message: "Verifying API Credentials...", timestamp: new Date().toLocaleTimeString() }
        ];
        setLogs(initialLogs);

        try {
            // 1. Check Credentials First
            const settingsRes = await fetch("/api/settings");
            const status = await settingsRes.json();
            let missingKeys = false;
            const checkLogs: Log[] = [];

            if (status.hasOpenAI) checkLogs.push({ type: "success", message: "OpenAI: Connected", timestamp: new Date().toLocaleTimeString() });
            else { checkLogs.push({ type: "error", message: "OpenAI: Missing Key", timestamp: new Date().toLocaleTimeString() }); missingKeys = true; }

            if (status.hasGemini) checkLogs.push({ type: "success", message: "Gemini: Connected", timestamp: new Date().toLocaleTimeString() });
            else { checkLogs.push({ type: "error", message: "Gemini: Missing Key (Required)", timestamp: new Date().toLocaleTimeString() }); missingKeys = true; }

            if (status.hasElevenLabs) checkLogs.push({ type: "success", message: "ElevenLabs: Connected", timestamp: new Date().toLocaleTimeString() });
            else { checkLogs.push({ type: "error", message: "ElevenLabs: Missing Key", timestamp: new Date().toLocaleTimeString() }); missingKeys = true; }

            if (status.hasPexels) checkLogs.push({ type: "success", message: "Pexels: Connected", timestamp: new Date().toLocaleTimeString() });
            else { checkLogs.push({ type: "error", message: "Pexels: Missing Key (Required)", timestamp: new Date().toLocaleTimeString() }); missingKeys = true; }

            // Update logs with check results
            setLogs(prev => [...prev, ...checkLogs]);

            if (missingKeys) {
                setLogs(prev => [...prev, { type: "error", message: "Aborting: Missing required API keys.", timestamp: new Date().toLocaleTimeString() }]);
                return; // Stop here
            }

            addLog("info", `Starting ${isTest ? "Test Ad" : "Batch Generation"} for ${project.name}...`);

            const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId: project.id,
                    projectName: project.name,
                    year,
                    month,
                    isTest,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
            }

            // Stream Reader Implementation
            const reader = res.body?.getReader();
            const decoder = new TextDecoder();

            if (reader) {
                let buffer = "";
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    // Keep the last partial line in buffer
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const evt = JSON.parse(line);

                            if (evt.type === 'log') {
                                addLog("info", evt.message);
                            } else if (evt.type === 'result') {
                                if (evt.status === 'success') {
                                    addLog("success", `Created: ${evt.file}`);
                                } else if (evt.status === 'skipped') {
                                    addLog("info", `Skipped (${evt.date}): ${evt.error}`);
                                } else {
                                    addLog("error", `Failed (${evt.date}): ${evt.error}`);
                                }
                            } else if (evt.type === 'error') {
                                addLog("error", `Server Error: ${evt.message}`);
                            } else if (evt.type === 'done') {
                                addLog("success", "Operation complete.");
                            }
                        } catch (e) {
                            console.warn("Failed to parse log line:", line);
                        }
                    }
                }
            } else {
                throw new Error("Browser does not support streaming.");
            }

        } catch (error: any) {
            addLog("error", `Critical Failure: ${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const { startDate, count } = calculateDays();

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Generation Settings</CardTitle>
                    <CardDescription>Configure batch parameters for {project.name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex space-x-4">
                        <div className="space-y-2 flex-1">
                            <Label>Year</Label>
                            <Input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value))} />
                        </div>
                        <div className="space-y-2 flex-1">
                            <Label>Month (1-12)</Label>
                            <Input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(parseInt(e.target.value))} />
                        </div>
                    </div>

                    <div className="p-4 bg-secondary/50 rounded-lg text-sm">
                        <div className="font-medium mb-1">Preview:</div>
                        <div>Target: {format(new Date(year, month - 1), 'MMMM yyyy')}</div>
                        <div>Est. Batch Size: {Math.floor(count)} days</div>
                        <div className="text-muted-foreground text-xs mt-1">
                            (From {format(startDate, 'MMM do')} to {format(endOfMonth(new Date(year, month - 1)), 'MMM do')})
                        </div>
                    </div>

                    <div className="flex space-x-3 pt-4">
                        <Button className="flex-1" variant="outline" onClick={() => handleGenerate(true)} disabled={isGenerating}>
                            <TestTube className="mr-2 h-4 w-4" /> Test Ad (1 Day)
                        </Button>
                        <Button className="flex-1" onClick={() => handleGenerate(false)} disabled={isGenerating}>
                            <Play className="mr-2 h-4 w-4" /> Generate Batch
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="flex flex-col h-[400px]">
                <CardHeader>
                    <CardTitle>Operation Log</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 relative">
                    <div ref={scrollRef} className="absolute inset-0 overflow-y-auto p-4 space-y-3 bg-black/20 rounded-md font-mono text-sm">
                        {logs.length === 0 && <span className="text-muted-foreground">Ready to generate...</span>}
                        {logs.map((log, i) => (
                            <div key={i} className="flex items-start space-x-2">
                                <span className="text-xs text-muted-foreground shrink-0 mt-0.5">{log.timestamp}</span>
                                {log.type === 'error' && <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />}
                                {log.type === 'success' && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                                {log.type === 'info' && <Info className="h-4 w-4 text-blue-400 shrink-0" />}
                                <span className={
                                    log.type === 'error' ? 'text-red-400' :
                                        log.type === 'success' ? 'text-green-400' : 'text-foreground'
                                }>
                                    {log.message}
                                </span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
