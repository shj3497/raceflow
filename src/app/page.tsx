import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HeroSection from '@/components/HeroSection';
import RaceList from '@/components/RaceList';
import { mockRaces } from '@/lib/mock-data';

export default function Home() {
  // TODO: Replace with actual API call: fetch('/api/races')
  const races = mockRaces;

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
