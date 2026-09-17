import { NextRequest } from "next/server";

import { paginate } from "@/lib/pagination";

const ITEMS = Array.from({ length: 47 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "0");
  const pageSize = Number(searchParams.get("pageSize") ?? "10");
  return Response.json(paginate(ITEMS, page, pageSize));
}
