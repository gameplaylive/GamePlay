import { GamerProfileClient } from "@/components/gamer/GamerProfileClient";

export const metadata = {
  title: "Gamer Profile | GamePlay Live",
  description: "Follow creators, watch their live stream, and browse recent gameplay.",
};

export default async function GamerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GamerProfileClient favoriteId={decodeURIComponent(id)} />;
}
