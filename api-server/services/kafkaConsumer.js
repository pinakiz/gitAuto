const { kafka } = require("../config/kafka");
const { v4 } = require("uuid");
const { client } = require("../config/clickhouse");

const consumer = kafka.consumer({
  groupId: "api-server-logs-consumer",
});

async function initKafkaConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topics: ["container-logs"] });

  await consumer.run({
    autoCommit: false,
    eachBatch: async ({ batch, heartbeat, commitOffsetsIfNecessary, resolveOffset }) => {
      console.log(`Received batch with ${batch.messages.length} messages`);
      try {
        const rows = batch.messages.map((message) => {
          const { DEPLOYMENT_ID, log } = JSON.parse(message.value.toString());
          return { event_id: v4(), deployment_id: DEPLOYMENT_ID, log };
        });

        await client.insert({
          table: "log_events",
          values: rows,
          format: "JSONEachRow",
        });

        for (const message of batch.messages) {
          resolveOffset(message.offset);
        }
        await commitOffsetsIfNecessary();
        await heartbeat();
      } catch (err) {
        console.error("Error inserting into ClickHouse:", err);
      }
    },
  });
}

module.exports = { initKafkaConsumer };
