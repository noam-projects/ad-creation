
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
    try {
        console.log("Attempting manual schema fix...");

        // Manual DDL to add columns if they don't exist
        // Note: Prisma uses double quotes for table names usually

        await db.$executeRawUnsafe(`ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "pexelsKey" TEXT;`);
        await db.$executeRawUnsafe(`ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "useGpu" BOOLEAN DEFAULT false;`);

        return NextResponse.json({ success: true, message: "Schema patched: pexelsKey and useGpu added if missing." });
    } catch (error: any) {
        console.error("Schema Fix Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
