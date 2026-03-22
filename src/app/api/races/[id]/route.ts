import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: race, error } = await supabase
    .from("races")
    .select("id, name, date, distance_km, course_gpx, split_points")
    .eq("id", id)
    .single();

  if (error || !race) {
    return NextResponse.json(
      { error: error?.message ?? "Race not found" },
      { status: error?.code === "PGRST116" ? 404 : 500 },
    );
  }

  const { count } = await supabase
    .from("results")
    .select("*", { count: "exact", head: true })
    .eq("race_id", id);

  return NextResponse.json({
    ...race,
    participant_count: count ?? 0,
  });
}
