const { prisma } = require("../../db");
const { z } = require("zod");

exports.getProject = async (req, res) => {
  try {
    const { project_id } = req.body;
    const project = await prisma.project.findUnique({
      where: { id: project_id },
      include: { Deployment: true },
    });
    res.status(200).json({ project });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
};

exports.createProject = async (req, res) => {
  const GIT_URL_REGEX = /((git|ssh|http(s)?)|(git@[\w\.]+))(:(\/\/)?)([\w\.@\:/\-~]+)(\.git)?(\/)?/;
  const schema = z.object({
    project_name: z.string(),
    giturl: z.string().regex(GIT_URL_REGEX),
  });

  const safeParseResult = schema.safeParse(req.body);
  if (safeParseResult.error) {
    return res.status(400).json({ status: "error", data: safeParseResult });
  }

  const { project_name, giturl } = safeParseResult.data;
  try {
    const projectRes = await prisma.project.create({
      data: {
        name: project_name,
        giturl,
        user: { connect: { id: req.decodedId.id } },
      },
    });
    res.status(200).json({ status: "success", data: projectRes });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
};

exports.listProjects = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.decodedId.id },
      include: { Project: true },
    });
    res.status(200).json({ projects: user.Project });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
};

exports.deleteProject = async (req, res) => {
  const { projectId } = req.body;
  try {
    await prisma.deployment.deleteMany({ where: { projectId } });
    const deleted = await prisma.project.delete({ where: { id: projectId } });
    res.json({ message: "Project and its deployments deleted", deleted });
  } catch (err) {
    res.status(400).json({ error: "Could not delete project", details: err });
  }
};
