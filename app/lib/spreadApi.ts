import axios from "axios";

const SHEET_ENDPOINT =
  "https://spread.name/sheet/HLa62rnH1xqfULNcK70EBnkkGHtmQ7ym2mxsSgr7sMv-XRYE54lsm6Zyck6Up5HCt5ju";

const OPTIONS_B64 =
  "eyJyb3dzTGltaXQiOjU3MDUsImRlYWxUeXBlIjoiYXBwc3VtbyIsImR5bmFtaWNEYXRhIjp7InNoZWV0SGFzaCI6IjE3ODE5ODY3ODUiLCJTQ1BUYWJsZUxhdGVzdFVwZGF0ZVRpbWVzdGFtcCI6MTcyMjQ3NTUxNzkyOH0sInNlYXJjaCI6eyJlbmFibGVkIjp0cnVlLCJjb2x1bW5zIjpbIlN0cmVldC9TdWJkaXZpc2lvbi0iLCJWaWNpbml0eS0iLCJCYXJhbmdheS0iLCJDaXR5LSJdfSwic29ydGluZyI6eyJlbmFibGVkIjpmYWxzZSwic2h1ZmZsZSI6ZmFsc2V9LCJwYWdpbmF0aW9uIjp7ImVuYWJsZWQiOnRydWUsIml0ZW1zUGVyUGFnZSI6IjE2In0sImZpbHRlcnMiOnsiZW5hYmxlZCI6dHJ1ZSwidmFsdWVzIjpbeyJpZCI6IkNpdHktIiwidHlwZSI6Im11bHRpcGxlIn0seyJpZCI6IkNsYXNzaWZpY2F0aW9uLSIsInR5cGUiOiJtdWx0aXBsZSJ9XX0sIm1hcFZpZXciOnsiZW5hYmxlZCI6ZmFsc2UsImlkIjoiU3RyZWV0L1N1YmRpdmlzaW9uLSIsIm1hcmtlclR5cGUiOiJwaW4iLCJpbWFnZUNvbElkIjoiIn0sImNhbGVuZGFyVmlldyI6eyJlbmFibGVkIjpmYWxzZSwic3RhcnREYXRlQ29sSWQiOm51bGwsInRpdGxlQ29sSWQiOiJTdHJlZXQvU3ViZGl2aXNpb24tIn19`"; // starts with eyJ...

function toB64Json(obj: unknown) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

export async function fetchZonalValuesRaw(page: number) {
  const queryB64 = toB64Json({ paginate: { currentPage: String(page) } });

  const url = new URL(SHEET_ENDPOINT);
  url.searchParams.set("query", queryB64);
  url.searchParams.set("options", OPTIONS_B64);

  const res = await axios.get(url.toString(), { timeout: 30000 });
  return res.data;
}
