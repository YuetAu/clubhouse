import type { YoutubeShareInfo } from "@/types/media";

interface Props {
  info?: YoutubeShareInfo;
}

export function YoutubeShareStub({ info }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-gray-800 border border-dashed border-gray-600 p-6 text-gray-500 aspect-video">
      <span className="text-3xl">▶️</span>
      <p className="text-sm font-medium">YouTube Share</p>
      {info?.label && <p className="text-xs">{info.label}</p>}
      <p className="text-xs italic">Not yet implemented</p>
    </div>
  );
}
