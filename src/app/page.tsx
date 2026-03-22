import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HeroSection from '@/components/HeroSection';
import RaceList from '@/components/RaceList';
import type { RaceSummary } from '@/lib/types';
import { createServiceClient } from '@/lib/supabase';

async function getRaces(): Promise<RaceSummary[]> {
  const supabase = createServiceClient();

  const { data: races, error } = await supabase
    .from('races')
    .select('id, name, date, distance_km');

  if (error || !races) return [];

  const racesWithCount = await Promise.all(
    races.map(async (race) => {
      const { count } = await supabase
        .from('results')
        .select('*', { count: 'exact', head: true })
        .eq('race_id', race.id);

      return {
        ...race,
        participant_count: count ?? 0,
      };
    }),
  );

  return racesWithCount;
}

export default async function Home() {
  const races = await getRaces();

  return (
    <>
      <Header />
      <HeroSection />
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 md:px-5 lg:px-6 py-8">
        <RaceList races={races} />
      </main>
      <Footer />
    </>
  );
}
