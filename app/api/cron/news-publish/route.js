import { runPublicationCycle } from "@/lib/news/publication-cycle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handlePublication(request) {
    const cronSecret = process.env.CRON_SECRET;
    const authorization = request.headers.get("authorization");

    if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
        return Response.json(
            { status: "unauthorized" },
            { status: 401 }
        );
    }

    try {
        const result = await runPublicationCycle({
            trigger: "scheduler",
            now: Date.now(),
        });

        return Response.json(result, {
            status: 200,
            headers: {
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        console.error("[cron/news-publish]", error);

        return Response.json(
            {
                status: "failed",
                error:
                    error instanceof Error
                        ? error.message
                        : "Unknown publication error",
            },
            {
                status: 503,
                headers: {
                    "Cache-Control": "no-store",
                },
            }
        );
    }
}

export async function GET(request) {
    return handlePublication(request);
}

export async function POST(request) {
    return handlePublication(request);
}
