const { client } = require("../config/clickhouse");

exports.fetchLogs = async (req, res) => {
  const { deploymentID } = req.body;
  try {
    const result = await client.query({
      query: `
        SELECT timestamp, log 
        FROM log_events 
        WHERE deployment_id = {deploymentID:String}
        ORDER BY timestamp ASC
      `,
      format: "JSONEachRow",
      query_params: { deploymentID },
    });
    const logs = await result.json();
    res.status(200).json(logs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch logs" });
  }
};
