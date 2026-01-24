const axios = require("axios");
const fetchZonalIndex = async (domain) => {
  const response = await axios.get(
    `https://api.spreadsimple.com/spread-view/public/omit-routes/${domain}`
  );
  const data = response.data;
  return {
    rowsLimit: data.customDealLimits.rowsLimit,
    sid: data.sid,
  };
};
const fetchZonalValues = async (domain) => {
  const zonalIndex = await fetchZonalIndex(domain);
  const options = {
    rowsLimit: zonalIndex.rowsLimit,
    pagination: {
      enabled: true,
      itemsPerPage: "16",
    },
  };
  const base64Options = btoa(JSON.stringify(options));
  const BASE_URL = `https://spread.name/sheet/${zonalIndex.sid}?query=${btoa(
    JSON.stringify({ paginate: { currentPage: "125" } })
  )}&options=${base64Options}`;
  const response = await axios.get(BASE_URL);
  const data = response.data;
  console.log(BASE_URL);
};
const fetchZonalRegions = async (search) => {
  const BASE_URL = `https://spread.name/sheet/9w4dKor11_OcyG8MZJVgwCoFdY43zK4KPd_G2IL4DKP2WwTintW0wptecz4odevpf2yw?query=${btoa(
    JSON.stringify({
      paginate: { currentPage: "1" },
      searchBy: {
        value: `${search}`,
      },
    })
  )}&options=eyJyb3dzTGltaXQiOjUwMDAsImRlYWxUeXBlIjoiYXBwc3VtbyIsImR5bmFtaWNEYXRhIjp7InNoZWV0SGFzaCI6IjIwNDUzOTY1NzAiLCJTQ1BUYWJsZUxhdGVzdFVwZGF0ZVRpbWVzdGFtcCI6MH0sInNlYXJjaCI6eyJlbmFibGVkIjp0cnVlLCJjb2x1bW5zIjpbIkNpdHktIiwiUHJvdmluY2UtIiwiQXJlYXNEYXRhYmFzZS0iXX0sInNvcnRpbmciOnsiZW5hYmxlZCI6ZmFsc2UsInNodWZmbGUiOmZhbHNlfSwicGFnaW5hdGlvbiI6eyJlbmFibGVkIjp0cnVlLCJpdGVtc1BlclBhZ2UiOiIxNiJ9LCJmaWx0ZXJzIjp7ImVuYWJsZWQiOnRydWUsInZhbHVlcyI6W119LCJtYXBWaWV3Ijp7ImVuYWJsZWQiOmZhbHNlLCJpZCI6IlN0cmVldC9TdWJkaXZpc2lvbi0iLCJtYXJrZXJUeXBlIjoicGluIiwiaW1hZ2VDb2xJZCI6IiJ9LCJjYWxlbmRhclZpZXciOnsiZW5hYmxlZCI6ZmFsc2UsInN0YXJ0RGF0ZUNvbElkIjpudWxsLCJ0aXRsZUNvbElkIjoiUHJvdmluY2UtIn19`;
  const response = await axios.get(BASE_URL);
  const data = response.data;
  console.log(BASE_URL);
};
fetchZonalValues(`ncr1stdistrict.zonalvalue.com`);
 //fetchZonalRegions("cebu");