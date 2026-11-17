import { GoLiveClient } from "@/components/go-live/GoLiveClient";

export const metadata = {
  title: "Go Live | GamePlay Live",
  description: "Stream your mobile screen directly to YouTube — Pro creators only.",
};

export default function GoLivePage() {
  return <GoLiveClient />;
}
