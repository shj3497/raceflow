import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServiceClient();

  const { data: races, error } = await supabase
    .from("races")
    .select("id, name, date, distance_km");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 각 대회의 참가자 수 조회
  const racesWithCount = await Promise.all(
    (races ?? []).map(async (race) => {
      const { count } = await supabase
        .from("results")
        .select("*", { count: "exact", head: true })
        .eq("race_id", race.id);

      return {
        ...race,
        participant_count: count ?? 0,
      };
    }),
  );

  return NextResponse.json({ races: racesWithCount });
}
