const { prisma } = require("../../db");
const { ECSClient, RunTaskCommand } = require("@aws-sdk/client-ecs");
const { generateSlug } = require("random-word-slugs");

const ecsClient = new ECSClient({
  region: process.env.AWS_REGION || "",
  credentials: {
    accessKeyId: process.env.ACCESS_ID,
    secretAccessKey: process.env.SECRET_ID,
  },
});

const config = {
  CLUSTER: process.env.CLUSTER,
  TASK: process.env.TASK,
};

exports.createDeployment = async (req, res) => {
  try {
    const { deployment_name, build_command, projectId } = req.body;
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ status: "error", data: "Project not found" });

    const projectSlug = generateSlug();
    const deployment = await prisma.deployment.create({
      data: {
        project: { connect: { id: projectId } },
        name: deployment_name,
        sub_domain: generateSlug(),
        status: "QUEUED",
      },
    });

    const command = new RunTaskCommand({
      cluster: config.CLUSTER,
      taskDefinition: config.TASK,
      launchType: "",
      count: 1,
      networkConfiguration: {
        awsvpcConfiguration: {
          assignPublicIp: "",
          subnets: ["", "", ""],
          securityGroups: [""],
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: "",
            environment: [
              { name: "ACCESS_ID", value: process.env.ACCESS_ID },
              { name: "SECRET_ID", value: process.env.SECRET_ID },
              { name: "GIT_REPOSITORY_URL", value: project.giturl },
              { name: "PROJECTID", value: projectId },
              { name: "DEPLOYMENT_ID", value: deployment.id },
              { name: "build_command", value: build_command },
              { name: "DATABASE_URL", value: process.env.DATABASE_URL },
            ],
          },
        ],
      },
    });

    await ecsClient.send(command);
    res.json({
      status: "queued",
      data: { projectSlug, url: `http://${projectSlug}.localhost:8000` },
    });
  } catch {
    res.status(500).json({ error: "Internal Server Issue" });
  }
};

exports.listDeployments = async (req, res) => {
  const { projectId } = req.body;
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { Deployment: true },
    });
    res.status(200).json({ Deployment: project.Deployment });
  } catch {
    res.status(500).json({ error: "Server Error" });
  }
};

exports.deleteDeployment = async (req, res) => {
  const { deploymentID } = req.body;
  try {
    const deleted = await prisma.deployment.delete({ where: { id: deploymentID } });
    res.json({ message: "Deployment deleted", deleted });
  } catch (err) {
    res.status(400).json({ error: "Could not delete deployment", details: err });
  }
};
