import { getMatchingEmbed } from "../lib/embeds";
import embeds from ".";

function resolve(url: string) {
  const match = getMatchingEmbed(embeds, url);
  if (!match) {
    return undefined;
  }
  const { embed, matches } = match;
  const height =
    typeof embed.height === "function" ? embed.height(matches) : embed.height;
  return {
    title: embed.title,
    src: embed.transformMatch?.(matches),
    height,
  };
}

describe("Chinese service embeds", () => {
  it.each([
    [
      "https://www.bilibili.com/video/BV1xx411c7mD?p=2&spm=x",
      "哔哩哔哩",
      "https://player.bilibili.com/player.html?bvid=BV1xx411c7mD&p=2&high_quality=1&autoplay=0",
    ],
    [
      "https://m.bilibili.com/video/av170001",
      "哔哩哔哩",
      "https://player.bilibili.com/player.html?aid=170001&p=1&high_quality=1&autoplay=0",
    ],
    [
      "https://player.bilibili.com/player.html?bvid=BV1xx411c7mD",
      "哔哩哔哩",
      "https://player.bilibili.com/player.html?bvid=BV1xx411c7mD",
    ],
    [
      "https://v.youku.com/v_show/id_XNTk0NTQ4MzU2.html?spm=a2h0c",
      "优酷",
      "https://player.youku.com/embed/XNTk0NTQ4MzU2",
    ],
    [
      "https://v.qq.com/x/cover/mzc00200abc/l01480qc099.html",
      "腾讯视频",
      "https://v.qq.com/txp/iframe/player.html?vid=l01480qc099&autoplay=false",
    ],
    [
      "https://v.qq.com/x/page/l01480qc099.html",
      "腾讯视频",
      "https://v.qq.com/txp/iframe/player.html?vid=l01480qc099&autoplay=false",
    ],
    [
      "https://music.163.com/#/song?id=1901371647",
      "网易云音乐",
      "https://music.163.com/outchain/player?type=2&id=1901371647&auto=0&height=66",
    ],
    [
      "https://music.163.com/playlist?id=3778678&userid=1",
      "网易云音乐",
      "https://music.163.com/outchain/player?type=0&id=3778678&auto=0&height=430",
    ],
    [
      "https://www.processon.com/view/link/5f1e0f8d1e085326373c3d81",
      "ProcessOn",
      "https://www.processon.com/view/link/5f1e0f8d1e085326373c3d81",
    ],
    [
      "https://code.juejin.cn/pen/7100000000000000000",
      "码上掘金",
      "https://code.juejin.cn/pen/7100000000000000000",
    ],
    [
      "https://modao.cc/proto/abc123/sharing",
      "墨刀",
      "https://modao.cc/proto/abc123/sharing",
    ],
    [
      "https://uri.amap.com/marker?position=116.39,39.9",
      "高德地图",
      "https://uri.amap.com/marker?position=116.39,39.9",
    ],
    [
      "https://jinshuju.net/f/AbC123",
      "金数据",
      "https://jinshuju.net/f/AbC123",
    ],
    [
      "https://www.aliwork.com/o/form123",
      "宜搭",
      "https://www.aliwork.com/o/form123",
    ],
    [
      "https://cloud.video.taobao.com/play/u/123/p/1/e/6/t/1/456.mp4",
      "淘宝视频",
      "https://cloud.video.taobao.com/play/u/123/p/1/e/6/t/1/456.mp4",
    ],
  ])("embeds %s", (url, title, src) => {
    expect(resolve(url)).toMatchObject({ title, src });
  });

  it("sizes music players by type", () => {
    expect(resolve("https://music.163.com/#/song?id=1")?.height).toBe(86);
    expect(resolve("https://music.163.com/#/album?id=1")?.height).toBe(450);
    expect(resolve("https://v.youku.com/v_show/id_X.html")?.height).toBe(420);
  });

  it("does not embed lookalike or insecure hosts as a service", () => {
    expect(
      resolve("https://evil.com/v.youku.com/v_show/id_X.html")?.title
    ).toBe("Embed");
    expect(resolve("http://v.youku.com/v_show/id_X.html")?.title).toBe("Embed");
    expect(resolve("https://music.163.com.evil.com/#/song?id=1")?.title).toBe(
      "Embed"
    );
    expect(resolve("https://processon.com.evil.com/view/x")?.title).toBe(
      "Embed"
    );
  });
});
