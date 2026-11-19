import { GoLiveClient } from "@/components/go-live/GoLiveClient";

export const metadata = {
  title: "Go Live | GamePlay Live",
  description:
    "Already live on YouTube or Twitch? Paste your link and appear on GamePlay Live instantly.",
};

export default function GoLivePage() {
  return <GoLiveClient />;
}
