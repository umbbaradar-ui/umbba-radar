import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "엄빠레이더",
    short_name: "엄빠레이더",
    description:
      "놓치는 혜택은 없게. 임신·출산·육아 협찬·체험단·후기를 한곳에 모은 큐레이션 앱.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFBEB",
    theme_color: "#FB7185",
    lang: "ko",
    orientation: "portrait",
    categories: ["lifestyle", "shopping", "parenting"],
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
