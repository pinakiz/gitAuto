const { Kafka } = require("kafkajs");
const { KAFKA_BROKERS } = require("./env");

const kafka = new Kafka({
  clientId: "deploy-service",
  brokers: KAFKA_BROKERS,
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: "deploy-group" });

module.exports = { kafka, producer, consumer };
