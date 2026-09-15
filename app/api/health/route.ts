// ponytail: the whole backend. Plain web Response, no next/server import, so the
// test can call GET() directly without booting Next.
export async function GET() {
  return Response.json({ status: "ok", time: new Date().toISOString() });
}
