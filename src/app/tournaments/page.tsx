import { TournamentsClient } from "@/components/tournaments/TournamentsClient";

export const metadata = {
  title: "Tournaments",
  description: "Live and upcoming esports tournaments — BGMI, Free Fire, Valorant, CS2, LoL, Dota 2.",
};

export default function TournamentsPage() {
  return <TournamentsClient />;
}
