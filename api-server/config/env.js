require("dotenv").config();

module.exports = {
  PORT: process.env.PORT || 9000,
  JWT_SECRET: process.env.JWT_TOKEN,
  PROJECT_ID: process.env.PROJECTID,
  AWS_REGION: process.env.AWS_REGION || "ap-south-1",
  ECS_CLUSTER: process.env.ECS_CLUSTER,
  ECS_TASK_DEF: process.env.ECS_TASK_DEF,
  S3_BUCKET: process.env.S3_BUCKET,
  CLICKHOUSE_URL: process.env.CLICKHOUSE_URL,
  KAFKA_BROKERS: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
};
