const app = require("./src/app");
const { initKafkaConsumer } = require("./src/services/kafkaConsumer");

const PORT = process.env.PORT || 9000;
initKafkaConsumer();
    
app.listen(PORT, () => {
  console.log(`API server running at : ${PORT}`);
});

