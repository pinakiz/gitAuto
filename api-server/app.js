const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { signup, signin, getToken, getProfile } = require("./controllers/authController");
const { getProject, createProject, listProjects, deleteProject } = require("./controllers/projectController");
const { createDeployment, listDeployments, deleteDeployment } = require("./controllers/deployController");
const { fetchLogs } = require("./controllers/logsController");

const authMiddleware = require("./middleware/auth");

const app = express();
app.use(express.json());
app.use(cors());

// ---------------- AUTH APIs ----------------
app.post("/signup", signup);
app.post("/signin", signin);
app.post("/getToken", authMiddleware, getToken);
app.post("/me", authMiddleware, getProfile);

// ---------------- PROJECT APIs ----------------
app.post("/projects", authMiddleware, getProject);
app.post("/project", authMiddleware, createProject);
app.post("/listProject", authMiddleware, listProjects);
app.post("/deleteProject", authMiddleware, deleteProject);

// ---------------- DEPLOY APIs ----------------
app.post("/deploy", createDeployment);
app.post("/listDeploy", authMiddleware, listDeployments);
app.post("/deleteDep", authMiddleware, deleteDeployment);

// ---------------- LOGS APIs ----------------
app.post("/fetchLogs", authMiddleware, fetchLogs);

module.exports = app;
