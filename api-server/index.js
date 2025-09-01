const express = require("express");
const { prisma } = require('../db/index')
const app = express();
const PORT = 9000;
const { generateSlug } = require("random-word-slugs");
const { ECSClient, RunTaskCommand } = require("@aws-sdk/client-ecs");
const {createClient} = require('@clickhouse/client')
const{z, uuidv4, json} = require("zod")
const {Kafka} = require('kafkajs');
const cors = require('cors')
const fs = require("fs")
const {v4} = require('uuid');
const bcrypt = require('bcrypt')
var jwt = require('jsonwebtoken');

//---------------- Configurations -----------------------
const path = require('path')
require("dotenv").config();

const jwt_seceret = process.env.JWT_TOKEN

const kafka = new Kafka({
    clientId: '',
    brokers: [""],
    ssl: {
        ca: [fs.readFileSync(path.join(__dirname,'kafka.pem'),'utf-8')],
        rejectUnauthorized: true
    },
    sasl: {
        username: '',
        password: '',
        mechanism: ''
    },
    connectionTimeout: 10000, // 10 seconds
    authenticationTimeout: 10000,
    retry: {
        initialRetryTime: 100,
        retries: 8
    }
});
const TOPIC_NAME = "container-logs";

const ecsClient = new ECSClient({
    region: "",
    credentials: {
        accessKeyId: process.env.ACCESS_ID,
        secretAccessKey: process.env.SECRET_ID,
    },
});
const config = {
    CLUSTER: process.env.CLUSTER,
    TASK: process.env.TASK,
};



const client = createClient({
    url:'',    
    database:'',
    username:'',
    password:''
})


const consumer = kafka.consumer({
    groupId: 'api-server-logs-consumer',
});
//-------------------------------- MIDDLEWARES ----------------------------------------------------
app.use(express.json());
app.use(cors());

function authMiddleWare(req, res, next){
    const authHeader = req.headers["authorization"];
    if(!authHeader) return res.status(401).json({error : "No Token Provided"});

    const token = authHeader.split(" ")[1];
    if(!token) return res.status(401).json({error : "No Token Provided"});
    
    jwt.verify(token, jwt_seceret, (err, decodedId) => {
        if (err) return res.status(403).json({ error: "Invalid/Expired token" });
        req.decodedId = decodedId;
        next();
    });
}
//---------------------------------- ENDPOINTS -------------------------------------------------------


//--------------------------------- AUTH APIs --------------------------------------------------------

app.post('/signup', async(req,res)=>{
    const {first_name,last_name,email,password} = req.body;
    try{
        const existing = await prisma.user.findUnique({
            where: { email }
        });
        if(existing) return res.status(400).json({error : "EMAIL ALREADY IN USE"});
        const hashed_password = await bcrypt.hash(password,10);

        const user = await prisma.user.create({
            data : {
                first_name,
                last_name,
                email,
                password : hashed_password
            }
        })
        const token = jwt.sign({ id: user.id }, jwt_seceret, { expiresIn: "3h" });
        res.status(200).json({message : "Success" , token : token});
    }catch{
        res.status(500).json({error : "Server error"});
    }
})

app.post('/signin' , async(req, res)=>{
    const {email, password} = req.body;
    try{
        const user = await prisma.user.findUnique({
            where : {email}
        })
        if(!user) return res.status(400).json({error : "Invalid Credentials"});
        const match = await bcrypt.compare(password,user.password);
        if(!match){
            return res.status(400).json({error : "Invalid Credentials"});
        }

        const token = await jwt.sign({ id: user.id }, jwt_seceret, { expiresIn: "3h" });
        return res.status(200).json({message : "Success" , token});
    }catch(err){
        return res.status(500).json({error : "Server  error"});
    }
})
app.post('/getToken' , authMiddleWare , async(req , res)=>{
    try{
        return res.status(200).json({token : req.decodedId.id});
    }catch{
        return res.status(500).json({error : "Server error"});
    }

})

app.post('/projects',authMiddleWare,async(req , res)=>{
    try{
        const {project_id} = req.body;
        const project = await prisma.project.findUnique({
            where : {id : project_id},
            include : {Deployment : true}
        })
        return res.status(200).json({project});
    }catch{
        return res.status(500).json({error : "Server error"});
    }
})
app.post('/me' , authMiddleWare ,async(req , res)=>{
    try{
        const user = await prisma.user.findUnique({
            where : {id : req.decodedId.id},
            include: { Project: true }
        })
        return res.status(200).json({user});
    }catch{
        return res.status(500).json({error : "Server error"});
    }

})

//--------------------------------- INTERNAL API ------------------------------------------------------
app.post('/project' , authMiddleWare ,async(req , res)=>{
    const GIT_URL_REGEX = /((git|ssh|http(s)?)|(git@[\w\.]+))(:(\/\/)?)([\w\.@\:/\-~]+)(\.git)?(\/)?/;
    const schema = z.object({
        project_name : z.string(),
        giturl : z.string().regex(GIT_URL_REGEX)
    })
    const safeParseResult = schema.safeParse(req.body);

    if(safeParseResult.error) {
        return res.status(400).json({status:'error' ,  data : safeParseResult});
    }

    const {project_name , giturl} = safeParseResult.data;

    const projectRes = await prisma.project.create({
        data:{
            name : project_name,
            giturl,
            user : {
                connect : {id : req.decodedId.id}
            }
        }
    })
    return res.status(200).json({status : 'success', data : projectRes })
})
app.post("/listProject" , authMiddleWare , async(req , res)=>{
    try{
        const user = await prisma.user.findUnique({
            where : {id : req.decodedId.id},
            include: { Project: true }
        })
        return res.status(200).json({projects : user.Project})
    }
    catch{
        return res.status(500),json({error : "Server Error"})
    }
    
})

app.post('/fetchLogs', authMiddleWare, async (req, res) => {
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
      query_params: { deploymentID }
    });
    const logs = await result.json();
    res.status(200).json(logs);

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

app.post('/listDeploy' , authMiddleWare , async(req , res)=>{
    const {projectId} = req.body;
    try{
        const project = await prisma.project.findUnique({
            where : {id : projectId},
            include: { Deployment: true }
        })
        return res.status(200).json({Deployment : project.Deployment})
    }
    catch{
        return res.status(500),json({error : "Server Error"})
    }
})

app.post('/deleteDep', async(req, res)=>{
    const {deploymentID} = req.body;
    try {
        const deleted = await prisma.deployment.delete({
            where: { id : deploymentID },
        });
        res.json({ message: "Deployment deleted", deleted });
    } catch (err) {
        res.status(400).json({ error: "Could not delete deployment", details: err });
    }

})
app.post('/deleteProject', async (req, res) => {
  const { projectId } = req.body;

  try {
    await prisma.deployment.deleteMany({
      where: { projectId },
    });
    const deleted = await prisma.project.delete({
      where: { id: projectId },
    });
    res.json({ message: "Project and its deployments deleted", deleted });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Could not delete project", details: err });
  }
});

app.post("/deploy", async (req, res) => {
    try{
        const { deployment_name , build_command, projectId } = req.body;

        const project = await prisma.project.findUnique({where:{ id : projectId}})
        if(!project) return res.status(404).json({status : 'error' , data : "Project not found"})
        const projectSlug = generateSlug();
        const deployment = await prisma.deployment.create({
            data : {
                project:{connect : {id : projectId}},
                name : deployment_name,
                sub_domain : generateSlug(),
                status:'QUEUED',
            }
        })
        const command = new RunTaskCommand({
            cluster: config.CLUSTER,
            taskDefinition: config.TASK,
            launchType: "",
            count: 1,
            networkConfiguration: {
                awsvpcConfiguration: {
                    assignPublicIp: "",
                    subnets: [
                        "",
                        "",
                        "",
                    ],
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
                            { name: "GIT_REPOSITORY_URL", value: project.giturl},
                            { name: "PROJECTID", value: projectId },
                            { name: "DEPLOYMENT_ID" , value: deployment.id},
                            { name: "build_command" , value: build_command},
                            { name: "DATABASE_URL" , value: process.env.DATABASE_URL},
                            
                        ],
                    },
                ],
            },
        });
        await ecsClient.send(command);
        return res.json({
            status: "queued",
            data: { projectSlug, url: `http://${projectSlug}.localhost:8000` },
        });

        }
        catch{
            res.status(500).json({error : "Internal Server Issue"});
        }
});

async function init_kafka_consumer() {
    await consumer.connect();
    await consumer.subscribe({topics : [TOPIC_NAME]})
await consumer.run({
  autoCommit: false,
  eachBatch: async function ({
    batch,
    heartbeat,
    commitOffsetsIfNecessary,
    resolveOffset,
  }) {
    console.log(`Received batch with ${batch.messages.length} messages`);

    try {
      const rows = batch.messages.map((message) => {
        const { _ ,DEPLOYMENT_ID, log } = JSON.parse(message.value.toString());
        console.log("MESSAGE :" , (DEPLOYMENT_ID))
        return {
          event_id: v4(),
          deployment_id: DEPLOYMENT_ID,
          log,
        };
      });
      console.log(rows);
      await client.insert({
        table: 'log_events',
        values: rows,
        format: 'JSONEachRow',
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

init_kafka_consumer()
app.listen(PORT, () => console.log(`Api server running at : ${PORT}`));
