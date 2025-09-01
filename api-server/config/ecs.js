const { ECS_CLUSTER, ECS_TASK_DEF, PROJECT_ID } = require("./env");

module.exports = {
  CLUSTER: ECS_CLUSTER,
  TASK_DEFINITION: ECS_TASK_DEF,
  PROJECT_ID,
};
