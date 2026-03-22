import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createServiceClient();

  // 대회 존재 확인
  const { data: race, error: raceError } = await supabase
    .from("races")
    .select("id")
    .eq("id", id)
    .single();

  if (raceError || !race) {
    return NextResponse.json(
      { error: "Race not found" },
      { status: 404 },
    );
  }

  // 참가자 스플릿 원본 데이터 조회 (Supabase 기본 limit 1000 → 전체 조회)
  const allResults: Record<string, unknown>[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("results")
      .select("bib_number, name, gender, age_group, net_time, splits")
      .eq("race_id", id)
      .order("net_time", { ascending: true, nullsFirst: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) break;
    allResults.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return NextResponse.json({ results: allResults });
}
